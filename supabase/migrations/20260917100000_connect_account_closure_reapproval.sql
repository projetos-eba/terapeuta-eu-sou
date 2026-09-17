-- A receiving account is part of the trust boundary for a public, bookable
-- therapist profile. Stripe account closure must therefore retire the public
-- publication and create a fresh, auditable administrative review; it must
-- never rewrite the prior approval or redirect historical Transfers.

begin;

alter table public.therapist_verifications
  add column if not exists review_origin text not null default 'profile_submission',
  add column if not exists source_connect_account_id uuid references public.therapist_connect_accounts(id) on delete set null,
  add column if not exists source_stripe_event_id text,
  add column if not exists restore_publication_on_approval boolean not null default false;

alter table public.therapist_verifications
  drop constraint if exists therapist_verifications_review_origin_check,
  add constraint therapist_verifications_review_origin_check
    check (review_origin in ('profile_submission', 'connect_account_closed'));

create unique index if not exists therapist_verifications_connect_closure_event_idx
  on public.therapist_verifications (therapist_profile_id, source_stripe_event_id)
  where review_origin = 'connect_account_closed' and source_stripe_event_id is not null;

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
      'receiving_account_closed'
    )
  );

insert into public.email_action_definitions (
  action_key, category, label, description, active, default_template_version
) values (
  'therapist_receiving_account_closed',
  'therapists',
  'Conta de recebimento encerrada',
  'Informa que uma conta de recebimento encerrada exige reconexão e nova análise administrativa.',
  true,
  'v1'
) on conflict (action_key) do nothing;

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

create or replace function public.require_reapproval_after_connect_account_closure_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_verification_id uuid;
begin
  if not (
    old.is_current
    and not new.is_current
    and new.disabled_reason = 'account_closed'
  ) then
    return new;
  end if;

  select * into v_profile
  from public.therapist_profiles
  where id = new.therapist_profile_id
  for update;

  -- Only a currently public, approved therapist re-enters review. A profile
  -- already private, suspended or awaiting another decision remains in its
  -- existing lifecycle while the account gate still blocks future bookings.
  if not found
    or v_profile.status <> 'approved'::public.therapist_status
    or v_profile.public_status <> 'published'
    or not v_profile.is_public
  then
    return new;
  end if;

  select id into v_verification_id
  from public.therapist_verifications
  where therapist_profile_id = v_profile.id
    and review_origin = 'connect_account_closed'
    and source_stripe_event_id = new.closed_stripe_event_id
  limit 1;

  if v_verification_id is not null then
    return new;
  end if;

  update public.therapist_profiles
  set status = 'submitted',
      public_status = 'unpublished',
      is_public = false,
      is_accepting_bookings = false,
      updated_at = now()
  where id = v_profile.id;

  insert into public.therapist_verifications (
    therapist_profile_id,
    status,
    review_origin,
    source_connect_account_id,
    source_stripe_event_id,
    restore_publication_on_approval,
    submitted_at
  ) values (
    v_profile.id,
    'submitted',
    'connect_account_closed',
    new.id,
    new.closed_stripe_event_id,
    true,
    now()
  ) returning id into v_verification_id;

  insert into public.therapist_profile_events (
    therapist_profile_id,
    event_type,
    previous_public_status,
    next_public_status,
    reason,
    metadata
  ) values (
    v_profile.id,
    'receiving_account_closed',
    v_profile.public_status,
    'unpublished',
    'Conta de recebimento encerrada; nova análise administrativa necessária.',
    jsonb_build_object(
      'connectAccountId', new.id,
      'stripeAccountId', new.stripe_account_id,
      'stripeEventId', new.closed_stripe_event_id,
      'verificationId', v_verification_id
    )
  );

  insert into public.notifications (
    profile_id, kind, title, body, href, event_key
  ) values (
    v_profile.user_id,
    'receiving_account_closed',
    'Sua conta de recebimento foi encerrada',
    'Seu perfil ficou indisponível para novos agendamentos. Conecte uma nova conta para que a equipe TES possa concluir uma nova análise.',
    '/terapeuta/financeiro?tab=conta',
    'receiving-account-closed:' || new.id::text
  ) on conflict (profile_id, event_key)
    where event_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists require_reapproval_after_connect_account_closure
  on public.therapist_connect_accounts;
create trigger require_reapproval_after_connect_account_closure
after update of is_current, disabled_reason on public.therapist_connect_accounts
for each row execute function public.require_reapproval_after_connect_account_closure_v1();

create or replace function public.restore_publication_after_connect_closure_approval_v1()
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
    or new.review_origin <> 'connect_account_closed'
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
    from jsonb_array_elements_text(coalesce(v_eligibility -> 'blockers', '[]'::jsonb)) blocker(code)
    where blocker.code not in ('profile_not_published', 'profile_not_public', 'not_accepting_bookings')
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
create trigger restore_publication_after_connect_closure_approval
after update of status on public.therapist_verifications
for each row execute function public.restore_publication_after_connect_closure_approval_v1();

-- Repair the known historical gap without firing a burst of retrospective
-- email. The in-app notice documents the action; future closures use the
-- normal trigger and the dedicated transactional email above.
select set_config('tes.suppress_therapist_lifecycle_email', 'true', true);
with affected as (
  select p.id as therapist_profile_id,
         p.user_id,
         account.id as connect_account_id,
         account.stripe_account_id,
         account.closed_stripe_event_id
  from public.therapist_profiles p
  join lateral (
    select a.*
    from public.therapist_connect_accounts a
    where a.therapist_profile_id = p.id
      and not a.is_current
      and a.disabled_reason = 'account_closed'
    order by a.closed_at desc nulls last, a.updated_at desc
    limit 1
  ) account on true
  where p.status = 'approved'::public.therapist_status
    and p.public_status = 'published'
    and p.is_public
    and not exists (
      select 1
      from public.therapist_connect_accounts current_account
      where current_account.therapist_profile_id = p.id
        and current_account.is_current
        and public.is_therapist_receiving_account_ready_v1(p.id)
    )
    and not exists (
      select 1
      from public.therapist_verifications verification
      where verification.therapist_profile_id = p.id
        and verification.review_origin = 'connect_account_closed'
    )
), queued as (
  update public.therapist_profiles profile
  set status = 'submitted', public_status = 'unpublished', is_public = false,
      is_accepting_bookings = false, updated_at = now()
  from affected
  where profile.id = affected.therapist_profile_id
  returning profile.id, profile.user_id
), created as (
  insert into public.therapist_verifications (
    therapist_profile_id, status, review_origin, source_connect_account_id,
    source_stripe_event_id, restore_publication_on_approval, submitted_at
  )
  select affected.therapist_profile_id, 'submitted', 'connect_account_closed',
         affected.connect_account_id, affected.closed_stripe_event_id, true, now()
  from affected
  join queued on queued.id = affected.therapist_profile_id
  returning id, therapist_profile_id, source_connect_account_id
)
insert into public.notifications (profile_id, kind, title, body, href, event_key)
select queued.user_id,
       'receiving_account_closed',
       'Sua conta de recebimento foi encerrada',
       'Seu perfil ficou indisponível para novos agendamentos. Conecte uma nova conta para que a equipe TES possa concluir uma nova análise.',
       '/terapeuta/financeiro?tab=conta',
       'receiving-account-closed:' || created.source_connect_account_id::text
from created
join queued on queued.id = created.therapist_profile_id
on conflict (profile_id, event_key) where event_key is not null do nothing;
select set_config('tes.suppress_therapist_lifecycle_email', 'false', true);

revoke all on function public.require_reapproval_after_connect_account_closure_v1() from public, anon, authenticated;
revoke all on function public.restore_publication_after_connect_closure_approval_v1() from public, anon, authenticated;

comment on function public.require_reapproval_after_connect_account_closure_v1() is
  'Atomically withdraws an approved public profile after a Stripe receiving-account closure and creates a new, immutable administrative review record.';
comment on function public.restore_publication_after_connect_closure_approval_v1() is
  'Restores the prior public switches only after a closure-origin review is approved and every other authoritative publication requirement is currently satisfied.';

commit;
