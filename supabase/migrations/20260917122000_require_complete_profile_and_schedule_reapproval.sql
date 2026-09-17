-- Public therapist profiles must remain complete and bookable. Removing the
-- final active recurring availability rule withdraws public publication and
-- opens a fresh administrative review without touching existing bookings.

begin;

alter table public.therapist_verifications
  add column if not exists source_schedule_event_id uuid
    references public.therapist_schedule_events(id) on delete set null;

alter table public.therapist_verifications
  drop constraint if exists therapist_verifications_review_origin_check,
  add constraint therapist_verifications_review_origin_check
    check (review_origin in (
      'profile_submission',
      'connect_account_closed',
      'availability_removed'
    ));

create unique index if not exists therapist_verifications_schedule_event_idx
  on public.therapist_verifications (
    therapist_profile_id,
    source_schedule_event_id
  )
  where review_origin = 'availability_removed'
    and source_schedule_event_id is not null;

alter table public.therapist_schedule_events
  add column if not exists previous_active_rule_count integer,
  add column if not exists active_rule_count integer,
  add column if not exists publication_impact text not null default 'none';

alter table public.therapist_schedule_events
  drop constraint if exists therapist_schedule_events_active_counts_check,
  add constraint therapist_schedule_events_active_counts_check check (
    (previous_active_rule_count is null or previous_active_rule_count >= 0)
    and (active_rule_count is null or active_rule_count >= 0)
  ),
  drop constraint if exists therapist_schedule_events_publication_impact_check,
  add constraint therapist_schedule_events_publication_impact_check check (
    publication_impact in ('none', 'reapproval_required')
  );

alter table public.therapist_profile_events
  drop constraint if exists therapist_profile_events_type,
  add constraint therapist_profile_events_type check (
    event_type in (
      'profile_draft_saved',
      'profile_media_draft_saved',
      'profile_draft_discarded',
      'profile_published',
      'profile_unpublished',
      'profile_slug_updated',
      'receiving_account_closed',
      'availability_removed'
    )
  );

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
) values (
  'therapist_availability_removed',
  'therapists',
  'Agenda sem horários disponíveis',
  'Informa que a remoção da última disponibilidade retirou o perfil de novos agendamentos e abriu uma nova análise.',
  true,
  'v1'
) on conflict (action_key) do nothing;

create or replace function public.get_therapist_publication_eligibility_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select *
    from public.therapist_profiles
    where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
      )::integer as online_bookable,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
      )::integer as published_therapy,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
          and public.therapy_has_active_matching_theme_v1(therapy.id)
      )::integer as eligible
    from public.therapist_services service
    join public.therapies therapy on therapy.id = service.therapy_id
    where service.therapist_profile_id = p_therapist_profile_id
      and service.archived_at is null
  ), completeness as (
    select public.therapist_profile_completeness_json_m1(profile.id) as value
    from profile
  ), availability as (
    select count(*)::integer as active_rule_count
    from public.availability_rules rule
    where rule.therapist_profile_id = p_therapist_profile_id
      and rule.is_active
  )
  select jsonb_build_object(
    'eligible', coalesce(
      profile.status = 'approved'::public.therapist_status
      and profile.public_status = 'published'
      and profile.is_public
      and profile.is_accepting_bookings
      and profile.accepts_online_sessions
      and coalesce((completeness.value ->> 'percent')::integer, 0) = 100
      and coalesce(availability.active_rule_count, 0) > 0
      and coalesce(services.eligible, 0) > 0
      and public.is_therapist_receiving_account_ready_v1(profile.id),
      false
    ),
    'blockers', coalesce((
      select jsonb_agg(code order by position)
      from unnest(array[
        case when profile.id is null then 'profile_not_found' end,
        case when profile.id is not null and profile.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
        case when profile.id is not null and profile.public_status <> 'published' then 'profile_not_published' end,
        case when profile.id is not null and not profile.is_public then 'profile_not_public' end,
        case when profile.id is not null and not profile.is_accepting_bookings then 'not_accepting_bookings' end,
        case when profile.id is not null and not profile.accepts_online_sessions then 'online_sessions_disabled' end,
        case when profile.id is not null and coalesce((completeness.value ->> 'percent')::integer, 0) < 100 then 'profile_incomplete' end,
        case when profile.id is not null and coalesce(availability.active_rule_count, 0) = 0 then 'no_active_availability' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) > 0 and coalesce(services.published_therapy, 0) = 0 then 'therapy_not_public' end,
        case when profile.id is not null and coalesce(services.published_therapy, 0) > 0 and coalesce(services.eligible, 0) = 0 then 'therapy_without_active_theme' end,
        case when profile.id is not null and not public.is_therapist_receiving_account_ready_v1(profile.id) then 'receiving_account_not_ready' end
      ]) with ordinality as blockers(code, position)
      where code is not null
    ), '[]'::jsonb),
    'eligibleServiceCount', coalesce(services.eligible, 0),
    'completenessPercent', coalesce((completeness.value ->> 'percent')::integer, 0),
    'incompleteItems', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', item.value ->> 'key',
          'label', item.value ->> 'label'
        )
        order by item.ordinality
      )
      from jsonb_array_elements(
        coalesce(completeness.value -> 'items', '[]'::jsonb)
      ) with ordinality as item(value, ordinality)
      where not coalesce((item.value ->> 'complete')::boolean, false)
    ), '[]'::jsonb),
    'activeAvailabilityRuleCount', coalesce(availability.active_rule_count, 0)
  )
  from services
  left join profile on true
  left join completeness on true
  left join availability on true
$$;

revoke all on function public.get_therapist_publication_eligibility_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_therapist_publication_eligibility_v1(uuid)
  to service_role;

create or replace function public.require_complete_profile_before_approval_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completeness jsonb;
begin
  if old.status is not distinct from new.status
    or new.status <> 'approved'::public.therapist_status
  then
    return new;
  end if;

  v_completeness := public.therapist_profile_completeness_json_m1(
    new.therapist_profile_id
  );

  if coalesce((v_completeness ->> 'percent')::integer, 0) <> 100 then
    raise exception 'THERAPIST_PROFILE_INCOMPLETE' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists require_complete_profile_before_approval
  on public.therapist_verifications;
create trigger require_complete_profile_before_approval
before update of status on public.therapist_verifications
for each row execute function public.require_complete_profile_before_approval_v1();

create or replace function public.enqueue_therapist_verification_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_key text;
  v_recipient_user_id uuid;
begin
  v_action_key := case
    when current_setting('tes.suppress_therapist_lifecycle_email', true) = 'true'
      then null
    when tg_op = 'INSERT'
      and new.status = 'submitted'::public.therapist_status
      and new.review_origin = 'connect_account_closed'
      then 'therapist_receiving_account_closed'
    when tg_op = 'INSERT'
      and new.status = 'submitted'::public.therapist_status
      and new.review_origin = 'availability_removed'
      then 'therapist_availability_removed'
    when tg_op = 'INSERT' and new.status = 'submitted'::public.therapist_status
      then 'therapist_profile_submitted_for_review'
    when tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status = 'submitted'::public.therapist_status
      then 'therapist_profile_submitted_for_review'
    when tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status = 'changes_requested'::public.therapist_status
      then 'therapist_documents_requested'
    when tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status = 'approved'::public.therapist_status
      then 'therapist_profile_approved'
    when tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status = 'rejected'::public.therapist_status
      then 'therapist_profile_rejected'
    else null
  end;

  if v_action_key is null then
    return new;
  end if;

  select therapist.user_id into v_recipient_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action_key,
      gen_random_uuid(),
      'therapist_verification',
      new.id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function public.restore_publication_after_reapproval_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_eligibility jsonb;
begin
  if old.status is not distinct from new.status
    or new.status <> 'approved'::public.therapist_status
    or new.review_origin not in ('connect_account_closed', 'availability_removed')
    or not new.restore_publication_on_approval
  then
    return new;
  end if;

  select * into v_profile
  from public.therapist_profiles
  where id = new.therapist_profile_id
  for update;

  if not found or v_profile.status = 'suspended'::public.therapist_status then
    return new;
  end if;

  update public.therapist_profiles
  set status = 'approved', updated_at = now()
  where id = v_profile.id;

  v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
  if not exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(v_eligibility -> 'blockers', '[]'::jsonb)
    ) blocker(code)
    where blocker.code not in (
      'profile_not_published',
      'profile_not_public',
      'not_accepting_bookings'
    )
  ) then
    update public.therapist_profiles
    set public_status = 'published',
        is_public = true,
        is_accepting_bookings = true,
        updated_at = now()
    where id = v_profile.id;
  end if;

  return new;
end;
$$;

drop trigger if exists restore_publication_after_connect_closure_approval
  on public.therapist_verifications;
drop trigger if exists restore_publication_after_reapproval
  on public.therapist_verifications;
create trigger restore_publication_after_reapproval
after update of status on public.therapist_verifications
for each row execute function public.restore_publication_after_reapproval_v1();

alter function public.get_therapist_schedule_v1()
  rename to get_therapist_schedule_v1_before_completion_gate;

create function public.get_therapist_schedule_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_profile_id uuid;
  v_active_rule_count integer;
  v_publicly_visible boolean;
begin
  v_result := public.get_therapist_schedule_v1_before_completion_gate();
  v_profile_id := (v_result ->> 'therapistProfileId')::uuid;

  select count(*)::integer into v_active_rule_count
  from public.availability_rules rule
  where rule.therapist_profile_id = v_profile_id
    and rule.is_active;

  select coalesce(
    profile.status = 'approved'::public.therapist_status
    and profile.public_status = 'published'
    and profile.is_public,
    false
  ) into v_publicly_visible
  from public.therapist_profiles profile
  where profile.id = v_profile_id;

  return v_result || jsonb_build_object(
    'contractVersion', 2,
    'activeRuleCount', v_active_rule_count,
    'isPubliclyVisible', v_publicly_visible
  );
end;
$$;

alter function public.save_therapist_schedule_v1(
  uuid, bigint, text, jsonb, jsonb, uuid
) rename to save_therapist_schedule_v1_before_completion_gate;

create function public.save_therapist_schedule_v1(
  p_actor_user_id uuid,
  p_expected_version bigint,
  p_timezone text,
  p_rules jsonb,
  p_service_settings jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_previous_active_rule_count integer;
  v_active_rule_count integer;
  v_event public.therapist_schedule_events%rowtype;
  v_result jsonb;
  v_publication_impact text := 'none';
  v_verification_id uuid;
begin
  select therapist.* into v_therapist
  from public.profiles profile
  join public.therapist_profiles therapist on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'therapist-schedule:' || v_therapist.id::text,
      0
    )
  );

  select * into v_therapist
  from public.therapist_profiles therapist
  where therapist.id = v_therapist.id
  for update;

  select * into v_event
  from public.therapist_schedule_events event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'scheduleVersion', v_event.resulting_version,
      'timezone', v_event.timezone,
      'idempotentReplay', true,
      'activeRuleCount', coalesce(v_event.active_rule_count, 0),
      'publicationImpact', v_event.publication_impact
    );
  end if;

  select count(*)::integer into v_previous_active_rule_count
  from public.availability_rules rule
  where rule.therapist_profile_id = v_therapist.id
    and rule.is_active;

  v_result := public.save_therapist_schedule_v1_before_completion_gate(
    p_actor_user_id,
    p_expected_version,
    p_timezone,
    p_rules,
    p_service_settings,
    p_request_id
  );

  select count(*)::integer into v_active_rule_count
  from public.availability_rules rule
  where rule.therapist_profile_id = v_therapist.id
    and rule.is_active;

  select * into v_event
  from public.therapist_schedule_events event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id
  for update;

  if v_previous_active_rule_count > 0
    and v_active_rule_count = 0
    and v_therapist.status = 'approved'::public.therapist_status
    and v_therapist.public_status = 'published'
    and v_therapist.is_public
  then
    v_publication_impact := 'reapproval_required';
  end if;

  update public.therapist_schedule_events
  set previous_active_rule_count = v_previous_active_rule_count,
      active_rule_count = v_active_rule_count,
      publication_impact = v_publication_impact
  where id = v_event.id;

  if v_publication_impact = 'reapproval_required' then
    update public.therapist_profiles
    set status = 'submitted',
        public_status = 'unpublished',
        is_public = false,
        is_accepting_bookings = false,
        updated_at = now()
    where id = v_therapist.id;

    insert into public.therapist_verifications (
      therapist_profile_id,
      status,
      review_origin,
      source_schedule_event_id,
      restore_publication_on_approval,
      submitted_at
    ) values (
      v_therapist.id,
      'submitted',
      'availability_removed',
      v_event.id,
      true,
      now()
    )
    on conflict (therapist_profile_id, source_schedule_event_id)
      where review_origin = 'availability_removed'
        and source_schedule_event_id is not null
      do nothing
    returning id into v_verification_id;

    if v_verification_id is null then
      select verification.id into v_verification_id
      from public.therapist_verifications verification
      where verification.therapist_profile_id = v_therapist.id
        and verification.source_schedule_event_id = v_event.id;
    end if;

    insert into public.therapist_profile_events (
      therapist_profile_id,
      actor_user_id,
      event_type,
      request_id,
      previous_public_status,
      next_public_status,
      reason,
      metadata
    ) values (
      v_therapist.id,
      p_actor_user_id,
      'availability_removed',
      p_request_id,
      v_therapist.public_status,
      'unpublished',
      'Último horário ativo removido; nova análise administrativa necessária.',
      jsonb_build_object(
        'scheduleEventId', v_event.id,
        'verificationId', v_verification_id,
        'previousActiveRuleCount', v_previous_active_rule_count,
        'activeRuleCount', v_active_rule_count
      )
    );

    insert into public.notifications (
      profile_id,
      kind,
      title,
      body,
      href,
      event_key
    ) values (
      v_therapist.user_id,
      'availability_removed',
      'Seu perfil ficou sem horários disponíveis',
      'Seu perfil está indisponível para novos agendamentos. Cadastre novos horários e aguarde uma nova análise da equipe TES.',
      '/terapeuta/agenda?aba=horarios',
      'availability-removed:' || v_event.id::text
    ) on conflict (profile_id, event_key)
      where event_key is not null do nothing;
  end if;

  return v_result || jsonb_build_object(
    'activeRuleCount', v_active_rule_count,
    'publicationImpact', v_publication_impact
  );
end;
$$;

revoke all on function public.get_therapist_schedule_v1_before_completion_gate()
  from public, anon, authenticated;
revoke all on function public.get_therapist_schedule_v1()
  from public, anon;
grant execute on function public.get_therapist_schedule_v1()
  to authenticated, service_role;

revoke all on function public.save_therapist_schedule_v1_before_completion_gate(
  uuid, bigint, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.save_therapist_schedule_v1(
  uuid, bigint, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.save_therapist_schedule_v1(
  uuid, bigint, text, jsonb, jsonb, uuid
) to service_role;

-- Repair approved public profiles that predate the authoritative completeness
-- gate and currently have no active recurring availability.
with affected as (
  select profile.id as therapist_profile_id, profile.user_id
  from public.therapist_profiles profile
  where profile.status = 'approved'::public.therapist_status
    and profile.public_status = 'published'
    and profile.is_public
    and not exists (
      select 1
      from public.availability_rules rule
      where rule.therapist_profile_id = profile.id
        and rule.is_active
    )
    and not exists (
      select 1
      from public.therapist_verifications verification
      where verification.therapist_profile_id = profile.id
        and verification.review_origin = 'availability_removed'
        and verification.status in (
          'submitted'::public.therapist_status,
          'in_review'::public.therapist_status,
          'changes_requested'::public.therapist_status
        )
    )
), withdrawn as (
  update public.therapist_profiles profile
  set status = 'submitted',
      public_status = 'unpublished',
      is_public = false,
      is_accepting_bookings = false,
      updated_at = now()
  from affected
  where profile.id = affected.therapist_profile_id
  returning profile.id, profile.user_id
), reviews as (
  insert into public.therapist_verifications (
    therapist_profile_id,
    status,
    review_origin,
    restore_publication_on_approval,
    submitted_at
  )
  select withdrawn.id, 'submitted', 'availability_removed', true, now()
  from withdrawn
  returning id, therapist_profile_id
), events as (
  insert into public.therapist_profile_events (
    therapist_profile_id,
    event_type,
    previous_public_status,
    next_public_status,
    reason,
    metadata
  )
  select reviews.therapist_profile_id,
         'availability_removed',
         'published',
         'unpublished',
         'Perfil público sem horário ativo; nova análise administrativa necessária.',
         jsonb_build_object(
           'verificationId', reviews.id,
           'historicalRepair', true,
           'activeRuleCount', 0
         )
  from reviews
  returning therapist_profile_id
)
insert into public.notifications (
  profile_id,
  kind,
  title,
  body,
  href,
  event_key
)
select withdrawn.user_id,
       'availability_removed',
       'Seu perfil ficou sem horários disponíveis',
       'Seu perfil está indisponível para novos agendamentos. Cadastre novos horários e aguarde uma nova análise da equipe TES.',
       '/terapeuta/agenda?aba=horarios',
       'availability-removed:historical:' || withdrawn.id::text
from withdrawn
join events on events.therapist_profile_id = withdrawn.id
on conflict (profile_id, event_key)
  where event_key is not null do nothing;

revoke all on function public.require_complete_profile_before_approval_v1()
  from public, anon, authenticated;
revoke all on function public.restore_publication_after_reapproval_v1()
  from public, anon, authenticated;

comment on function public.get_therapist_publication_eligibility_v1(uuid) is
  'Fail-closed public profile gate requiring 100 percent canonical completeness, active availability, eligible service and a ready receiving account.';
comment on function public.save_therapist_schedule_v1(
  uuid, bigint, text, jsonb, jsonb, uuid
) is
  'Atomic schedule command that withdraws public publication and opens reapproval when the final active recurring availability is removed.';
comment on function public.restore_publication_after_reapproval_v1() is
  'Restores prior public switches after an authorized reapproval only when every current publication requirement is satisfied.';

commit;
