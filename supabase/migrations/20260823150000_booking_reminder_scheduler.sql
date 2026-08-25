do $$
begin
  create type public.booking_reminder_job_status as enum (
    'scheduled',
    'processing',
    'enqueued',
    'cancelled',
    'missed',
    'skipped',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
)
values
  (
    'booking_reminder_24h_patient',
    'bookings',
    'Lembrete de encontro — 24 horas — pessoa',
    'Lembra a pessoa sobre um encontro confirmado 24 horas antes do horário persistido.',
    true,
    'v1'
  ),
  (
    'booking_reminder_1h_patient',
    'bookings',
    'Lembrete de encontro — 1 hora — pessoa',
    'Lembra a pessoa sobre um encontro confirmado 1 hora antes do horário persistido.',
    true,
    'v1'
  )
on conflict (action_key) do nothing;

insert into public.email_action_settings (
  action_key,
  enabled,
  automatic_dispatch_enabled
)
values
  ('booking_reminder_24h_patient', false, false),
  ('booking_reminder_1h_patient', false, false)
on conflict (action_key) do nothing;

create table if not exists public.booking_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  booking_version integer not null check (booking_version > 0),
  action_key text not null references public.email_action_definitions (action_key) on delete restrict,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_for timestamptz not null,
  status public.booking_reminder_job_status not null default 'scheduled',
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  lease_owner uuid,
  lease_expires_at timestamptz,
  outbox_id uuid references public.email_outbox (id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_reminder_jobs_action_check check (
    action_key in (
      'booking_reminder_24h_patient',
      'booking_reminder_1h_patient'
    )
  ),
  constraint booking_reminder_jobs_unique_key unique (
    booking_id,
    booking_version,
    action_key,
    recipient_user_id
  )
);

create index if not exists booking_reminder_jobs_due_idx
on public.booking_reminder_jobs (status, scheduled_for, created_at)
where status = 'scheduled';

create index if not exists booking_reminder_jobs_booking_idx
on public.booking_reminder_jobs (booking_id, booking_version, status);

drop trigger if exists set_booking_reminder_jobs_updated_at
on public.booking_reminder_jobs;
create trigger set_booking_reminder_jobs_updated_at
before update on public.booking_reminder_jobs
for each row execute function public.set_updated_at();

alter table public.booking_reminder_jobs enable row level security;
revoke all on public.booking_reminder_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.booking_reminder_jobs to service_role;

create or replace function public.schedule_booking_reminder_jobs_v1(
  p_booking_id uuid,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_patient_user_id uuid;
  v_created integer := 0;
begin
  if p_booking_id is null or p_now is null then
    raise exception 'BOOKING_REMINDER_INVALID_SCHEDULE_REQUEST';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.status <> 'confirmed' or v_booking.starts_at <= p_now then
    return 0;
  end if;

  select *
    into v_payment
  from public.session_payments
  where booking_id = p_booking_id;

  if not found
    or v_payment.financial_status not in ('paid', 'partially_refunded')
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.internal_contested_at is not null
    or v_payment.admin_blocked_at is not null
  then
    return 0;
  end if;

  select patient.user_id
    into v_patient_user_id
  from public.patient_profiles patient
  where patient.id = v_booking.patient_profile_id;

  if v_patient_user_id is null then
    return 0;
  end if;

  insert into public.booking_reminder_jobs (
    booking_id,
    booking_version,
    action_key,
    recipient_user_id,
    scheduled_for
  )
  select
    v_booking.id,
    v_booking.version,
    reminder.action_key,
    v_patient_user_id,
    reminder.scheduled_for
  from (
    values
      (
        'booking_reminder_24h_patient'::text,
        v_booking.starts_at - interval '24 hours'
      ),
      (
        'booking_reminder_1h_patient'::text,
        v_booking.starts_at - interval '1 hour'
      )
  ) as reminder(action_key, scheduled_for)
  where reminder.scheduled_for > p_now
  on conflict (
    booking_id,
    booking_version,
    action_key,
    recipient_user_id
  ) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

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

create or replace function public.run_booking_reminder_scheduler_v1(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.booking_reminder_jobs;
  v_booking_status public.booking_status;
  v_booking_version integer;
  v_starts_at timestamptz;
  v_payment_status public.session_financial_status;
  v_refund_pending boolean;
  v_disputed_at timestamptz;
  v_internal_contested_at timestamptz;
  v_admin_blocked_at timestamptz;
  v_patient_user_id uuid;
  v_expected_scheduled_for timestamptz;
  v_outbox_id uuid;
  v_reason text;
  v_worker_id uuid := gen_random_uuid();
  v_recovered integer := 0;
  v_missed integer := 0;
  v_claimed integer := 0;
  v_enqueued integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
begin
  if p_now is null or p_limit < 1 or p_limit > 100 then
    raise exception 'BOOKING_REMINDER_INVALID_RUN_REQUEST';
  end if;

  update public.booking_reminder_jobs
  set status = case
        when scheduled_for > p_now - interval '1 minute'
          then 'scheduled'::public.booking_reminder_job_status
        else 'missed'::public.booking_reminder_job_status
      end,
      lease_owner = null,
      lease_expires_at = null,
      last_error = case
        when scheduled_for > p_now - interval '1 minute' then last_error
        else 'scheduler_tick_missed'
      end
  where status = 'processing'
    and lease_expires_at is not null
    and lease_expires_at <= p_now;
  get diagnostics v_recovered = row_count;

  update public.booking_reminder_jobs
  set status = 'missed',
      last_error = 'scheduler_tick_missed',
      lease_owner = null,
      lease_expires_at = null
  where status = 'scheduled'
    and scheduled_for < p_now - interval '1 minute';
  get diagnostics v_missed = row_count;

  for v_job in
    select *
    from public.booking_reminder_jobs
    where status = 'scheduled'
      and scheduled_for <= p_now
      and scheduled_for > p_now - interval '1 minute'
    order by scheduled_for, created_at
    limit p_limit
    for update skip locked
  loop
    v_claimed := v_claimed + 1;

    update public.booking_reminder_jobs
    set status = 'processing',
        attempts = attempts + 1,
        lease_owner = v_worker_id,
        lease_expires_at = p_now + interval '2 minutes',
        last_error = null
    where id = v_job.id;

    v_booking_status := null;
    v_booking_version := null;
    v_starts_at := null;
    v_payment_status := null;
    v_refund_pending := null;
    v_disputed_at := null;
    v_internal_contested_at := null;
    v_admin_blocked_at := null;
    v_patient_user_id := null;
    v_expected_scheduled_for := null;
    v_outbox_id := null;
    v_reason := null;

    begin
      select
        booking.status,
        booking.version,
        booking.starts_at,
        payment.financial_status,
        payment.refund_pending,
        payment.disputed_at,
        payment.internal_contested_at,
        payment.admin_blocked_at,
        patient.user_id
      into
        v_booking_status,
        v_booking_version,
        v_starts_at,
        v_payment_status,
        v_refund_pending,
        v_disputed_at,
        v_internal_contested_at,
        v_admin_blocked_at,
        v_patient_user_id
      from public.bookings booking
      left join public.session_payments payment on payment.booking_id = booking.id
      left join public.patient_profiles patient on patient.id = booking.patient_profile_id
      where booking.id = v_job.booking_id
      for update of booking;

      v_expected_scheduled_for := case v_job.action_key
        when 'booking_reminder_24h_patient' then v_starts_at - interval '24 hours'
        when 'booking_reminder_1h_patient' then v_starts_at - interval '1 hour'
        else null
      end;

      if v_booking_status is null then
        v_reason := 'booking_not_found';
      elsif v_booking_status <> 'confirmed' then
        v_reason := 'booking_not_confirmed';
      elsif v_booking_version is distinct from v_job.booking_version then
        v_reason := 'booking_version_changed';
      elsif v_starts_at <= p_now then
        v_reason := 'booking_already_started';
      elsif v_patient_user_id is null or v_patient_user_id <> v_job.recipient_user_id then
        v_reason := 'patient_recipient_changed';
      elsif v_payment_status not in ('paid', 'partially_refunded') then
        v_reason := 'payment_not_eligible';
      elsif coalesce(v_refund_pending, true)
        or v_disputed_at is not null
        or v_internal_contested_at is not null
        or v_admin_blocked_at is not null
      then
        v_reason := 'payment_blocked';
      elsif v_expected_scheduled_for is distinct from v_job.scheduled_for then
        v_reason := 'reminder_schedule_changed';
      end if;

      if v_reason is not null then
        update public.booking_reminder_jobs
        set status = case
              when v_reason in ('booking_not_confirmed', 'booking_version_changed', 'booking_already_started', 'patient_recipient_changed', 'payment_not_eligible', 'payment_blocked', 'reminder_schedule_changed')
                then 'cancelled'::public.booking_reminder_job_status
              else 'failed'::public.booking_reminder_job_status
            end,
            last_error = v_reason,
            lease_owner = null,
            lease_expires_at = null
        where id = v_job.id;
        if v_reason = 'booking_not_found' then
          v_failed := v_failed + 1;
        else
          v_skipped := v_skipped + 1;
        end if;
      else
        v_outbox_id := public.enqueue_transactional_email_v1(
          v_job.action_key,
          v_job.id,
          'booking',
          v_job.booking_id,
          v_job.recipient_user_id,
          'profile:' || v_job.recipient_user_id::text,
          '{}'::jsonb
        );

        if v_outbox_id is null then
          update public.booking_reminder_jobs
          set status = 'skipped',
              last_error = 'automatic_dispatch_disabled',
              lease_owner = null,
              lease_expires_at = null
          where id = v_job.id;
          v_skipped := v_skipped + 1;
        else
          update public.booking_reminder_jobs
          set status = 'enqueued',
              outbox_id = v_outbox_id,
              lease_owner = null,
              lease_expires_at = null
          where id = v_job.id;
          v_enqueued := v_enqueued + 1;
        end if;
      end if;
    exception
      when others then
        update public.booking_reminder_jobs
        set status = 'failed',
            last_error = left(
              pg_catalog.regexp_replace(sqlerrm, '[\r\n]+', ' ', 'g'),
              500
            ),
            lease_owner = null,
            lease_expires_at = null
        where id = v_job.id;
        v_failed := v_failed + 1;
    end;
  end loop;

  return pg_catalog.jsonb_build_object(
    'workerId', v_worker_id,
    'recovered', v_recovered,
    'missed', v_missed,
    'claimed', v_claimed,
    'enqueued', v_enqueued,
    'skipped', v_skipped,
    'failed', v_failed
  );
end;
$$;

create or replace function public.enqueue_booking_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_patient_action_key text;
  v_therapist_action_key text;
begin
  if new.event_type = 'booking_created'
    and new.next_status::text = 'confirmed'
  then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    return new;
  end if;

  if new.event_type = 'booking_status_changed'
    and new.next_status::text = 'confirmed'
  then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    v_patient_action_key := 'booking_confirmed_patient';
    v_therapist_action_key := 'booking_confirmed_therapist';
  elsif new.event_type = 'booking_status_changed'
    and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
  then
    perform public.cancel_booking_reminder_jobs_v1(
      new.booking_id,
      'booking_status_changed'
    );
    v_patient_action_key := 'booking_cancelled_patient';
    v_therapist_action_key := 'booking_cancelled_therapist';
  elsif new.event_type = 'booking_reschedule_resolved'
    and new.payload ->> 'status' = 'applied'
  then
    perform public.cancel_booking_reminder_jobs_v1(
      new.booking_id,
      'booking_rescheduled'
    );
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    v_patient_action_key := 'booking_rescheduled_patient';
    v_therapist_action_key := 'booking_rescheduled_therapist';
  else
    return new;
  end if;

  select
    patient.user_id,
    therapist.user_id
  into
    v_patient_user_id,
    v_therapist_user_id
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if v_patient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_patient_action_key,
      new.id,
      'booking',
      new.booking_id,
      v_patient_user_id,
      'profile:' || v_patient_user_id::text,
      '{}'::jsonb
    );
  end if;

  if v_therapist_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_therapist_action_key,
      new.id,
      'booking',
      new.booking_id,
      v_therapist_user_id,
      'profile:' || v_therapist_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

revoke all on function public.schedule_booking_reminder_jobs_v1(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.cancel_booking_reminder_jobs_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.run_booking_reminder_scheduler_v1(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.enqueue_booking_email_v1() from public, anon, authenticated;

grant execute on function public.schedule_booking_reminder_jobs_v1(uuid, timestamptz) to service_role;
grant execute on function public.cancel_booking_reminder_jobs_v1(uuid, text) to service_role;
grant execute on function public.run_booking_reminder_scheduler_v1(timestamptz, integer) to service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'tes-booking-reminders-v1'
  ) then
    perform cron.unschedule('tes-booking-reminders-v1');
  end if;

  perform cron.schedule(
    'tes-booking-reminders-v1',
    '* * * * *',
    $cron$select public.run_booking_reminder_scheduler_v1();$cron$
  );
end;
$$;

comment on table public.booking_reminder_jobs is
  'Persistent patient booking reminder jobs. It stores only booking references, schedule version, action, recipient reference, target time and bounded operational state.';

comment on function public.schedule_booking_reminder_jobs_v1(uuid, timestamptz) is
  'Creates strict-window patient reminder jobs atomically from a confirmed, financially eligible booking.';

comment on function public.cancel_booking_reminder_jobs_v1(uuid, text) is
  'Invalidates pending patient reminder jobs and suppresses pending outbox rows after booking lifecycle changes.';

comment on function public.run_booking_reminder_scheduler_v1(timestamptz, integer) is
  'Claims due patient reminder jobs once per scheduler tick, revalidates booking/payment/version state and enqueues through the transactional email outbox.';
