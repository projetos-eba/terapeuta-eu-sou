create or replace function public.sync_therapist_verification_queue_on_publish_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verification_id uuid;
  v_verification_status public.therapist_status;
  v_target_status public.therapist_status;
begin
  if not new.is_public
    or new.public_status <> 'published'
    or new.status in (
      'approved'::public.therapist_status,
      'suspended'::public.therapist_status
    )
  then
    return new;
  end if;

  select
    therapist_verifications.id,
    therapist_verifications.status
  into
    v_verification_id,
    v_verification_status
  from public.therapist_verifications
  where therapist_verifications.therapist_profile_id = new.id
  order by
    therapist_verifications.submitted_at desc nulls last,
    therapist_verifications.created_at desc,
    therapist_verifications.id desc
  limit 1
  for update;

  if v_verification_id is null then
    v_target_status := case
      when new.status = 'in_review'::public.therapist_status
        then 'in_review'::public.therapist_status
      else 'submitted'::public.therapist_status
    end;

    insert into public.therapist_verifications (
      therapist_profile_id,
      status,
      submitted_at
    )
    values (
      new.id,
      v_target_status,
      now()
    );
  elsif v_verification_status in (
    'draft'::public.therapist_status,
    'changes_requested'::public.therapist_status,
    'rejected'::public.therapist_status
  ) then
    v_target_status := 'submitted'::public.therapist_status;

    update public.therapist_verifications
    set
      status = v_target_status,
      changes_requested = null,
      rejection_reason = null,
      reviewed_by = null,
      reviewed_at = null,
      submitted_at = now(),
      updated_at = now()
    where id = v_verification_id;
  else
    v_target_status := v_verification_status;
  end if;

  if v_target_status in (
    'submitted'::public.therapist_status,
    'in_review'::public.therapist_status
  )
  then
    update public.therapist_profiles
    set
      status = v_target_status,
      updated_at = now()
    where id = new.id
      and status in (
        'draft'::public.therapist_status,
        'submitted'::public.therapist_status,
        'in_review'::public.therapist_status,
        'changes_requested'::public.therapist_status,
        'rejected'::public.therapist_status
      )
      and status is distinct from v_target_status;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_therapist_verification_queue_on_publish_v1()
  from public, anon, authenticated;

drop trigger if exists sync_therapist_verification_queue_on_publish
  on public.therapist_profiles;

create trigger sync_therapist_verification_queue_on_publish
after update of is_public, public_status on public.therapist_profiles
for each row
execute function public.sync_therapist_verification_queue_on_publish_v1();

create or replace function public.enforce_therapist_verification_transition_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if (old.status = 'draft'::public.therapist_status
      and new.status = 'submitted'::public.therapist_status)
    or (old.status = 'submitted'::public.therapist_status
      and new.status = 'in_review'::public.therapist_status)
    or (old.status = 'in_review'::public.therapist_status
      and new.status in (
        'approved'::public.therapist_status,
        'changes_requested'::public.therapist_status,
        'rejected'::public.therapist_status
      ))
    or (old.status in (
        'changes_requested'::public.therapist_status,
        'rejected'::public.therapist_status
      ) and new.status in (
        'submitted'::public.therapist_status,
        'in_review'::public.therapist_status
      ))
  then
    return new;
  end if;

  raise exception 'invalid therapist verification status transition'
    using errcode = '22023';
end;
$$;

revoke all on function public.enforce_therapist_verification_transition_v1()
  from public, anon, authenticated;

drop trigger if exists enforce_therapist_verification_transition
  on public.therapist_verifications;

create trigger enforce_therapist_verification_transition
before update of status on public.therapist_verifications
for each row
execute function public.enforce_therapist_verification_transition_v1();

-- Repair only profiles that already crossed the validated publication boundary.
insert into public.therapist_verifications (
  therapist_profile_id,
  status,
  submitted_at
)
select
  therapist_profiles.id,
  case
    when therapist_profiles.status = 'in_review'::public.therapist_status
      then 'in_review'::public.therapist_status
    else 'submitted'::public.therapist_status
  end,
  coalesce(therapist_profiles.last_published_at, therapist_profiles.updated_at, now())
from public.therapist_profiles
where therapist_profiles.is_public
  and therapist_profiles.public_status = 'published'
  and therapist_profiles.status in (
    'draft'::public.therapist_status,
    'submitted'::public.therapist_status,
    'in_review'::public.therapist_status,
    'changes_requested'::public.therapist_status,
    'rejected'::public.therapist_status
  )
  and not exists (
    select 1
    from public.therapist_verifications
    where therapist_verifications.therapist_profile_id = therapist_profiles.id
  );

with latest_verifications as (
  select distinct on (therapist_verifications.therapist_profile_id)
    therapist_verifications.id,
    therapist_verifications.status
  from public.therapist_verifications
  join public.therapist_profiles
    on therapist_profiles.id = therapist_verifications.therapist_profile_id
  where therapist_profiles.is_public
    and therapist_profiles.public_status = 'published'
    and therapist_profiles.status not in (
      'approved'::public.therapist_status,
      'suspended'::public.therapist_status
    )
  order by
    therapist_verifications.therapist_profile_id,
    therapist_verifications.submitted_at desc nulls last,
    therapist_verifications.created_at desc,
    therapist_verifications.id desc
)
update public.therapist_verifications
set
  status = 'submitted'::public.therapist_status,
  changes_requested = null,
  rejection_reason = null,
  reviewed_by = null,
  reviewed_at = null,
  submitted_at = now(),
  updated_at = now()
from latest_verifications
where therapist_verifications.id = latest_verifications.id
  and latest_verifications.status in (
    'draft'::public.therapist_status,
    'changes_requested'::public.therapist_status,
    'rejected'::public.therapist_status
  );

with latest_verifications as (
  select distinct on (therapist_verifications.therapist_profile_id)
    therapist_verifications.therapist_profile_id,
    therapist_verifications.status
  from public.therapist_verifications
  order by
    therapist_verifications.therapist_profile_id,
    therapist_verifications.submitted_at desc nulls last,
    therapist_verifications.created_at desc,
    therapist_verifications.id desc
)
update public.therapist_profiles
set
  status = latest_verifications.status,
  updated_at = now()
from latest_verifications
where therapist_profiles.id = latest_verifications.therapist_profile_id
  and therapist_profiles.is_public
  and therapist_profiles.public_status = 'published'
  and therapist_profiles.status in (
    'draft'::public.therapist_status,
    'submitted'::public.therapist_status,
    'in_review'::public.therapist_status,
    'changes_requested'::public.therapist_status,
    'rejected'::public.therapist_status
  )
  and latest_verifications.status in (
    'submitted'::public.therapist_status,
    'in_review'::public.therapist_status
  )
  and therapist_profiles.status is distinct from latest_verifications.status;

comment on function public.sync_therapist_verification_queue_on_publish_v1() is
  'Keeps profile publication and its administrative verification queue entry in the same transaction without auto-approving profiles.';

comment on function public.enforce_therapist_verification_transition_v1() is
  'Enforces submitted, in-review and decision sequencing for therapist verification records.';

comment on trigger sync_therapist_verification_queue_on_publish
  on public.therapist_profiles is
  'Queues eligible published therapist profiles for administrative review atomically.';

comment on trigger enforce_therapist_verification_transition
  on public.therapist_verifications is
  'Prevents administrative verification decisions from skipping or reopening terminal states.';
