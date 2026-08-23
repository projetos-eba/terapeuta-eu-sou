create or replace function public.cancel_booking_reminder_jobs_v1(
  p_booking_id uuid,
  p_reason text default 'booking_not_eligible'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := left(
    pg_catalog.regexp_replace(
      coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'booking_not_eligible'),
      '[^a-zA-Z0-9_.-]+',
      '_',
      'g'
    ),
    120
  );
  v_cancelled integer := 0;
begin
  if p_booking_id is null then
    raise exception 'BOOKING_REMINDER_INVALID_CANCEL_REQUEST';
  end if;

  update public.email_outbox outbox
  set status = 'skipped'::public.email_outbox_status,
      last_error = 'booking_reminder_invalidated',
      next_attempt_at = null,
      locked_at = null,
      locked_by = null,
      processed_at = coalesce(processed_at, now())
  where outbox.id in (
    select job.outbox_id
    from public.booking_reminder_jobs job
    where job.booking_id = p_booking_id
      and job.outbox_id is not null
  )
    and outbox.status in ('pending', 'retry_pending');

  update public.booking_reminder_jobs
  set status = 'cancelled',
      last_error = v_reason,
      lease_owner = null,
      lease_expires_at = null
  where booking_id = p_booking_id
    and status in ('scheduled', 'processing', 'enqueued');

  get diagnostics v_cancelled = row_count;
  return v_cancelled;
end;
$$;

revoke all on function public.cancel_booking_reminder_jobs_v1(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_booking_reminder_jobs_v1(uuid, text)
to service_role;
