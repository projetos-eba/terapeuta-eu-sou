-- V10 confirms deferred payments at T-24, when the 24-hour reminder target is
-- already due. Keep the action and scheduler contract available for a future
-- reactivation, but disable delivery and retire work that has not been sent.

do $$
begin
  if not exists (
    select 1
    from public.email_action_definitions
    where action_key = 'booking_reminder_24h_patient'
  ) then
    raise exception 'booking_reminder_24h_patient definition is missing';
  end if;

  update public.email_action_definitions
  set active = false
  where action_key = 'booking_reminder_24h_patient';

  insert into public.email_action_settings (
    action_key,
    enabled,
    automatic_dispatch_enabled
  )
  values (
    'booking_reminder_24h_patient',
    false,
    false
  )
  on conflict (action_key) do update
  set enabled = excluded.enabled,
      automatic_dispatch_enabled = excluded.automatic_dispatch_enabled,
      updated_at = now();

  update public.booking_reminder_jobs
  set status = 'cancelled',
      last_error = 'booking_reminder_24h_inactive_v10',
      lease_owner = null,
      lease_expires_at = null
  where action_key = 'booking_reminder_24h_patient'
    and status in ('scheduled', 'processing', 'enqueued');

  update public.email_outbox
  set status = 'skipped',
      last_error = 'booking_reminder_24h_inactive_v10',
      next_attempt_at = null,
      locked_at = null,
      locked_by = null,
      processed_at = coalesce(processed_at, now())
  where action_key = 'booking_reminder_24h_patient'
    and status in ('pending', 'retry_pending');
end;
$$;
