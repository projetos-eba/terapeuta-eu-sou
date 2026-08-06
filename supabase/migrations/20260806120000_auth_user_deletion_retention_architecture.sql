-- TES account deletion retention architecture.
--
-- Supabase Auth users are login credentials. Public profiles are operational
-- identities and must outlive Auth deletion so bookings, finance, legal
-- evidence, messages and audit trails remain consistent.

create extension if not exists pg_cron with schema extensions;

alter table public.profiles
  add column if not exists auth_deleted_at timestamptz,
  add column if not exists anonymized_at timestamptz,
  add column if not exists deletion_source text;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

create or replace function public.prepare_profile_for_auth_user_delete_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set auth_deleted_at = coalesce(auth_deleted_at, now()),
         anonymized_at = coalesce(anonymized_at, now()),
         deletion_source = 'supabase_auth',
         display_name = 'Usuário removido',
         email = null,
         phone = null,
         avatar_url = null,
         email_confirmed_at = null,
         updated_at = now()
   where id = old.id;

  return old;
end;
$$;

drop trigger if exists before_auth_user_delete_preserve_profile_v1
on auth.users;

create trigger before_auth_user_delete_preserve_profile_v1
before delete on auth.users
for each row
execute function public.prepare_profile_for_auth_user_delete_v1();

comment on function public.prepare_profile_for_auth_user_delete_v1() is
  'Anonymizes public profile PII before a Supabase Auth user is deleted. Operational profile rows are preserved for TES audit/history.';

comment on column public.profiles.auth_deleted_at is
  'Timestamp mirrored when the corresponding Supabase Auth user is deleted.';

comment on column public.profiles.anonymized_at is
  'Timestamp when direct profile PII was minimized after account deletion.';

comment on column public.profiles.deletion_source is
  'Deletion source for account removal workflows. Expected value for Authentication panel deletion: supabase_auth.';

-- Author references may disappear; operational events and messages must not.

alter table public.messages
  alter column sender_profile_id drop not null;

alter table public.messages
  drop constraint if exists messages_sender_profile_id_fkey,
  add constraint messages_sender_profile_id_fkey
    foreign key (sender_profile_id)
    references public.profiles (id)
    on delete set null;

alter table public.therapist_schedule_events
  alter column actor_user_id drop not null;

alter table public.therapist_schedule_events
  drop constraint if exists therapist_schedule_events_actor_user_id_fkey,
  add constraint therapist_schedule_events_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles (id)
    on delete set null;

alter table public.therapist_service_events
  alter column actor_user_id drop not null;

alter table public.therapist_service_events
  drop constraint if exists therapist_service_events_actor_user_id_fkey,
  add constraint therapist_service_events_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles (id)
    on delete set null;

alter table public.availability_exception_events
  alter column actor_user_id drop not null;

alter table public.availability_exception_events
  drop constraint if exists availability_exception_events_actor_user_id_fkey,
  add constraint availability_exception_events_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles (id)
    on delete set null;

alter table public.booking_reschedule_requests
  alter column requested_by_profile_id drop not null;

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_requested_by_profile_id_fkey,
  add constraint booking_reschedule_requests_requested_by_profile_id_fkey
    foreign key (requested_by_profile_id)
    references public.profiles (id)
    on delete set null;

alter table public.therapist_private_documents
  alter column uploaded_by drop not null;

alter table public.therapist_private_documents
  drop constraint if exists therapist_private_documents_uploaded_by_fkey,
  add constraint therapist_private_documents_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.profiles (id)
    on delete set null;

-- One central entrypoint for temporary data cleanup. It is scheduled below with
-- pg_cron so operational temporary data does not depend on manual maintenance.

create or replace function public.purge_temporary_data_v1(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email_status_tokens_deleted integer := 0;
  v_auth_tokens_deleted integer := 0;
  v_zoom_issue_limits_deleted integer := 0;
begin
  perform public.expire_booking_holds_v1(p_now);
  perform public.expire_booking_reschedule_requests_v1(p_now);

  delete from public.email_verification_status_tokens
   where expires_at < p_now
      or revoked_at is not null
      or confirmed_at is not null;
  get diagnostics v_email_status_tokens_deleted = row_count;

  delete from public.auth_action_tokens
   where expires_at < p_now
      or consumed_at is not null
      or revoked_at is not null;
  get diagnostics v_auth_tokens_deleted = row_count;

  delete from public.zoom_video_access_issue_limits
   where window_started_at < p_now - interval '24 hours';
  get diagnostics v_zoom_issue_limits_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'ran_at', p_now,
    'email_verification_status_tokens_deleted', v_email_status_tokens_deleted,
    'auth_action_tokens_deleted', v_auth_tokens_deleted,
    'zoom_video_access_issue_limits_deleted', v_zoom_issue_limits_deleted
  );
end;
$$;

revoke all on function public.purge_temporary_data_v1(timestamptz)
from public, anon, authenticated;

grant execute on function public.purge_temporary_data_v1(timestamptz)
to service_role;

comment on function public.purge_temporary_data_v1(timestamptz) is
  'Expires booking holds/reschedule requests and purges transient auth/email/Zoom rate-limit data. Intended for a scheduled service-role job.';

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'tes-purge-temporary-data-v1'
  ) then
    perform cron.unschedule('tes-purge-temporary-data-v1');
  end if;

  perform cron.schedule(
    'tes-purge-temporary-data-v1',
    '*/15 * * * *',
    $cron$select public.purge_temporary_data_v1(now());$cron$
  );
end;
$$;
