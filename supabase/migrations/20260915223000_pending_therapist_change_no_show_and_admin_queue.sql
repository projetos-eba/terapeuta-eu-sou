-- A pending therapist-led change is a protected decision period: it cannot
-- become a patient no-show while the patient is choosing a new slot or refund.

create or replace function public.reserve_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 10,
  p_lock_seconds integer default 60
)
returns table (
  id uuid,
  video_session_id uuid,
  booking_id uuid,
  provider_session_id text,
  operation public.video_session_control_operation,
  attempts integer,
  max_attempts integer
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select job.id
    from public.video_session_control_jobs job
    join public.video_sessions session on session.id = job.video_session_id
    join public.bookings booking on booking.id = job.booking_id
    where job.environment = p_environment
      and job.status in ('queued', 'retry')
      and job.next_run_at <= now()
      and coalesce(job.locked_until_at, '-infinity'::timestamptz) <= now()
      and job.attempts < job.max_attempts
      and session.termination_confirmed_at is null
      and session.status not in ('ended', 'canceled')
      and (
        job.operation <> 'end_patient_no_show'
        or pg_catalog.pg_try_advisory_xact_lock(
          pg_catalog.hashtextextended(booking.id::text, 0)
        )
      )
      and (
        (job.operation = 'end_scheduled' and session.scheduled_ends_at <= now())
        or (
          job.operation = 'end_hard_timeout'
          and session.hard_ends_at is not null
          and session.hard_ends_at <= now()
        )
        or (
          job.operation = 'end_patient_no_show'
          and session.status = 'active'
          and session.scheduled_starts_at = booking.starts_at
          and session.scheduled_ends_at = booking.ends_at
          and booking.status = 'confirmed'::public.booking_status
          and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
          and exists (
            select 1 from public.session_payments payment
            where payment.booking_id = booking.id
              and payment.financial_status = 'paid'::public.session_financial_status
          )
          and not exists (
            select 1
            from public.booking_reschedule_requests request
            where request.booking_id = booking.id
              and request.status = 'pending'
              and request.change_kind in (
                'therapist_reschedule', 'therapist_cancellation'
              )
          )
          and booking.starts_at + interval '10 minutes' < now()
          and booking.ends_at > now()
          and job.metadata ->> 'bookingVersion' = booking.version::text
          and job.metadata ->> 'scheduledStartsAt' = booking.starts_at::text
          and not exists (
            select 1 from public.booking_events event
            where event.booking_id = booking.id
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = booking.version::text
              and event.payload ->> 'scheduledStartsAt' = booking.starts_at::text
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.video_session_id = session.id
              and participation.participant_role = 'patient'::public.video_session_participant_role
              and participation.event_type = 'session.user_joined'
          )
        )
        or (
          job.operation = 'confirm_end'
          and session.termination_requested_at is not null
          and (
            session.termination_reason = 'manual_end'
            or (session.termination_reason = 'scheduled_end' and session.scheduled_ends_at <= now())
            or (session.termination_reason = 'hard_timeout' and session.hard_ends_at is not null and session.hard_ends_at <= now())
            or (session.termination_reason = 'provider_ended' and session.scheduled_ends_at <= now())
          )
        )
      )
    order by job.next_run_at, job.created_at
    for update of job, session, booking skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs job
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(
          secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))
        ),
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.id, job.video_session_id, job.booking_id, job.operation,
      job.attempts, job.max_attempts
  ),
  fenced as (
    update public.video_sessions session
    set termination_requested_at = case
          when updated.operation = 'confirm_end' then session.termination_requested_at
          else coalesce(session.termination_requested_at, now())
        end,
        termination_reason = case updated.operation
          when 'end_scheduled' then 'scheduled_end'
          when 'end_hard_timeout' then 'hard_timeout'
          when 'end_patient_no_show' then 'patient_no_show'
          else session.termination_reason
        end,
        last_maintenance_at = now(),
        updated_at = now()
    from updated
    where session.id = updated.video_session_id
    returning session.id, session.provider_session_id
  )
  select updated.id, updated.video_session_id, updated.booking_id,
    fenced.provider_session_id, updated.operation, updated.attempts,
    updated.max_attempts
  from updated
  join fenced on fenced.id = updated.video_session_id;
$$;

revoke all on function public.reserve_video_session_control_jobs_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_video_session_control_jobs_v1(text, integer, integer)
  to service_role;

-- The existing V10 admin projection already powers the financial queue. Add a
-- sanitized state so the same queue identifies decisions that need an Admin,
-- without exposing payment-provider identifiers or participant messages.
create or replace function public.private_admin_session_payout_projection_v10(
  p_session_payment_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'payout_display_status', case
      when coalesce(open_debt.open_amount_cents, 0) > 0
        then 'compensation_pending'
      when job.status = 'reversed' or transfer.status = 'reversed'
        then 'reversed'
      when payment.financial_status = 'refunded'
        then 'refunded'
      when job.status = 'offset_only'
        then 'compensated'
      when job.status in ('partially_reversed', 'failed')
        or transfer.status = 'failed'
        then 'failed'
      when job.status = 'reconciliation_required'
        or transfer.status = 'reconciliation_required'
        then 'needs_review'
      when paid_payout.id is not null
        then 'paid'
      when job.status in ('pending_source', 'transferred')
        or transfer.status = 'transferred'
        then 'bank_pending'
      when job.status in ('queued', 'creating')
        then 'processing'
      else 'processing'
    end,
    'financial_review_status', case when exists (
      select 1
      from public.booking_reschedule_requests request
      where request.booking_id = payment.booking_id
        and request.status = 'pending_admin_review'
        and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
    ) then 'therapist_change_refund_review' else null end,
    'debt_offset_amount_cents', job.debt_offset_amount_cents,
    'transfer_effective_amount_cents', job.transfer_amount_cents,
    'bank_paid_at', paid_payout.paid_at
  ))
  from public.session_payments payment
  left join public.session_transfer_jobs job
    on job.session_payment_id = payment.id
  left join public.stripe_transfers transfer
    on transfer.id = job.stripe_transfer_id
  left join lateral (
    select coalesce(sum(debt.open_amount_cents), 0)::integer
      as open_amount_cents
    from public.therapist_financial_debts debt
    where debt.session_payment_id = payment.id
      and debt.status = 'open'
      and debt.open_amount_cents > 0
  ) open_debt on true
  left join lateral (
    select payout.id, payout.paid_at
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
      and allocation.allocation_origin = 'session_direct'
      and allocation.amount_cents = transfer.amount_cents
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
    order by payout.paid_at desc nulls last, payout.id desc
    limit 1
  ) paid_payout on true
  where payment.id = p_session_payment_id
    and payment.payment_flow_version = 'v10';
$$;

revoke all on function public.private_admin_session_payout_projection_v10(uuid)
  from public, anon, authenticated;
