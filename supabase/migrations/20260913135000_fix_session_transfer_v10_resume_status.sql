-- Align the manual V10 retry projection with the canonical transfer enum.

create or replace function public.resume_session_transfer_job_v10(
  p_job_id uuid,
  p_expected_attempt_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.session_transfer_jobs%rowtype;
begin
  if p_job_id is null
    or p_expected_attempt_count is null
    or p_expected_attempt_count < 1
  then
    raise exception 'SESSION_TRANSFER_RESUME_V10_INVALID'
      using errcode = '22023';
  end if;

  select * into v_job
  from public.session_transfer_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.status <> 'failed'
    or v_job.attempt_count <> p_expected_attempt_count
    or v_job.prepared_at is not null
    or v_job.stripe_transfer_id is not null
  then
    return jsonb_build_object(
      'resumed', false,
      'reason', 'manual_reconciliation_required'
    );
  end if;

  update public.session_transfer_jobs
  set status = 'creating',
      last_error_code = null,
      next_retry_at = now(),
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_job.id;

  update public.session_payments
  set transfer_status = 'transfer_pending',
      updated_at = now()
  where id = v_job.session_payment_id
    and financial_status = 'paid'
    and not refund_pending;

  return jsonb_build_object('resumed', true, 'reason', 'operator_resumed');
end;
$$;

revoke all on function public.resume_session_transfer_job_v10(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.resume_session_transfer_job_v10(uuid, integer)
  to service_role;

comment on function public.resume_session_transfer_job_v10(uuid, integer) is
  'Explicitly resumes an unprepared V10 Transfer job after operations resolves its definitive preflight failure.';
