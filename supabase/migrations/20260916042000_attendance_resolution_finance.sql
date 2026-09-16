-- Administrative attendance decisions derive every amount and eligibility
-- server-side. External Refund/Reversal calls remain in the existing V10
-- command and are never executed by the attendance finalizer.

create or replace function public.admin_resolve_session_attendance_v1(
  p_incident_id uuid,
  p_resolution text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_incident public.session_confirmation_incidents%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_reschedule jsonb;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null
  ) then
    raise exception 'SESSION_ATTENDANCE_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_incident_id is null or p_request_id is null
    or p_resolution not in (
      'performed', 'reschedule', 'refund', 'retain',
      'platform_reschedule', 'platform_refund'
    )
    or length(btrim(coalesce(p_reason, ''))) not between 20 and 1000
  then
    raise exception 'SESSION_ATTENDANCE_RESOLUTION_INVALID' using errcode = '22023';
  end if;

  select * into v_incident
  from public.session_confirmation_incidents
  where id = p_incident_id for update;
  if not found then raise exception 'SESSION_ATTENDANCE_INCIDENT_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_booking from public.bookings
  where id = v_incident.booking_id for update;
  select * into v_payment from public.session_payments
  where id = v_incident.session_payment_id for update;
  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.patient_profiles as patient,
    public.therapist_profiles as therapist
  where patient.id = v_booking.patient_profile_id
    and therapist.id = v_booking.therapist_profile_id;

  if v_incident.resolution_request_id = p_request_id then
    return jsonb_build_object(
      'idempotentReplay', true,
      'incidentId', v_incident.id,
      'bookingId', v_incident.booking_id,
      'paymentId', v_incident.session_payment_id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'resolution', v_incident.operational_resolution,
      'financialResolution', v_incident.financial_resolution,
      'requiresProviderRefund',
        v_incident.operational_resolution = 'refund'
          and v_incident.financial_resolution = 'refund_pending'
    );
  end if;
  if v_incident.status <> 'open' then
    raise exception 'SESSION_ATTENDANCE_INCIDENT_ALREADY_RESOLVED' using errcode = '23505';
  end if;

  if p_resolution = 'retain' and (
    v_incident.classification <> 'no_show_both'
    or not v_incident.retention_authorized
  ) then
    raise exception 'SESSION_ATTENDANCE_RETENTION_NOT_AUTHORIZED' using errcode = '23514';
  end if;
  if p_resolution = 'performed'
    and v_incident.classification <> 'requires_review'
  then
    raise exception 'SESSION_ATTENDANCE_PERFORMED_NOT_ALLOWED' using errcode = '23514';
  end if;

  if p_resolution in ('reschedule', 'platform_reschedule') then
    if v_booking.status in ('no_show_therapist', 'no_show_both') then
      perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
      perform pg_catalog.set_config('tes.booking_reason', 'attendance_reschedule_approved', true);
      perform pg_catalog.set_config('tes.booking_request_id', p_request_id::text, true);
      perform pg_catalog.set_config('tes.booking_source', 'admin-attendance', true);
      update public.bookings set status = 'confirmed', updated_at = now()
      where id = v_booking.id;
      select * into v_booking from public.bookings where id = v_booking.id;
    end if;

    v_reschedule := public.open_therapist_booking_change_v1(
      v_booking.id,
      v_therapist_user_id,
      'reschedule',
      'Novo horário autorizado após análise do TES.',
      'attendance-reschedule:' || p_request_id::text,
      v_booking.version
    );

    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed',
        responsibility = case
          when p_resolution = 'platform_reschedule' then 'platform'
          else case classification
          when 'no_show_therapist' then 'therapist'
          when 'no_show_both' then 'both'
          else 'inconclusive'
          end
        end,
        operational_resolution = 'reschedule',
        financial_resolution = 'reschedule_pending',
        resolution_reason = btrim(p_reason),
        resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id,
        resolved_at = now(), updated_at = now()
    where id = v_incident.id;

    update public.session_payments
    set service_status = 'scheduled'::public.session_service_status,
        service_confirmed_at = null,
        service_confirmation_source = null,
        eligible_at = null,
        refund_pending = false,
        admin_blocked_at = null,
        internal_contested_at = null,
        transfer_status = case
          when transfer_status in ('batched', 'transfer_pending', 'transferred', 'reversed')
            then transfer_status
          else 'waiting_confirmation'::public.session_transfer_status
        end,
        transfer_blocked_reason = null,
        updated_at = now()
    where id = v_payment.id;
  elsif p_resolution in ('refund', 'platform_refund') then
    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed',
        responsibility = case
          when p_resolution = 'platform_refund' then 'platform'
          else case classification
          when 'no_show_therapist' then 'therapist'
          when 'no_show_both' then 'both'
          else 'inconclusive'
          end
        end,
        operational_resolution = 'refund',
        financial_resolution = 'refund_pending',
        resolution_reason = btrim(p_reason),
        resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id,
        resolved_at = now(), updated_at = now()
    where id = v_incident.id;
    update public.session_payments
    set refund_pending = true,
        admin_blocked_at = coalesce(admin_blocked_at, now()),
        transfer_blocked_reason = 'attendance_refund_review',
        updated_at = now()
    where id = v_payment.id;
  elsif p_resolution = 'retain' then
    insert into public.session_cancellation_decisions (
      booking_id, session_payment_id, policy_version_id,
      requested_by_profile_id, requested_by_role, request_id, reason,
      decision, refund_amount_cents, retained_amount_cents,
      therapist_retained_cents, platform_retained_cents,
      requires_manual_review, review_due_at, processed_at, metadata
    ) values (
      v_booking.id, v_payment.id, v_payment.policy_version_id,
      v_actor_id, 'admin', p_request_id, btrim(p_reason),
      'double_no_show_retained', 0, v_payment.gross_amount_cents,
      0, v_payment.gross_amount_cents, false, null, now(),
      jsonb_build_object(
        'attendanceIncidentId', v_incident.id,
        'stripeFeeAmountCents', v_payment.stripe_fee_amount_cents,
        'netPlatformResultCents', case
          when v_payment.stripe_fee_amount_cents is null then null
          else v_payment.gross_amount_cents - v_payment.stripe_fee_amount_cents
        end
      )
    );
    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed', responsibility = 'both',
        operational_resolution = 'retain', financial_resolution = 'retained',
        resolution_reason = btrim(p_reason), resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id, resolved_at = now(), updated_at = now()
    where id = v_incident.id;
  else
    update public.session_confirmation_incidents
    set status = 'performed_confirmed', responsibility = 'inconclusive',
        operational_resolution = 'performed', financial_resolution = 'no_action',
        resolution_reason = btrim(p_reason), resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id, resolved_at = now(), updated_at = now()
    where id = v_incident.id;
    update public.session_payments
    set admin_blocked_at = null, internal_contested_at = null,
        transfer_blocked_reason = null, refund_pending = false, updated_at = now()
    where id = v_payment.id;
    perform public.confirm_session_service(
      v_booking.id, 'admin'::public.session_confirmation_source, v_actor_id,
      null, jsonb_build_object('attendanceIncidentId', v_incident.id,
        'confirmationModel', 'attendance_admin_resolution')
    );
  end if;

  insert into public.notifications (profile_id, kind, title, body, href, event_key)
  values
    (
      v_patient_user_id,
      'session_attendance_resolution_patient',
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Reagendamento autorizado'
        when p_resolution in ('refund', 'platform_refund')
          then 'Reembolso autorizado'
        else 'Análise do encontro concluída'
      end,
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Você já pode escolher um novo horário com o mesmo terapeuta, sem nova cobrança.'
        when p_resolution in ('refund', 'platform_refund')
          then 'O reembolso integral foi autorizado e seguirá para conclusão financeira.'
        when p_resolution = 'retain'
          then 'A análise foi concluída conforme a política aceita para esta reserva. Você pode contestar pelo Suporte.'
        when p_resolution = 'performed'
          then 'As evidências foram revisadas e o encontro foi confirmado como realizado.'
        else 'A ocorrência foi atribuída à plataforma e será tratada sem prejuízo aos participantes.'
      end,
      '/app/encontros/' || v_booking.id::text,
      'attendance-resolution:' || v_incident.id::text || ':patient'
    ),
    (
      v_therapist_user_id,
      'session_attendance_resolution_therapist',
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Reagendamento autorizado'
        when p_resolution in ('refund', 'platform_refund')
          then 'Reembolso autorizado'
        else 'Análise da sessão concluída'
      end,
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'O cliente poderá escolher um novo horário, sem nova cobrança.'
        when p_resolution in ('refund', 'platform_refund')
          then 'O reembolso integral foi autorizado. Consulte o Financeiro para acompanhar a conciliação.'
        when p_resolution = 'retain'
          then 'A sessão foi encerrada sem remuneração conforme a política aceita para a reserva.'
        when p_resolution = 'performed'
          then 'As evidências foram revisadas e a sessão foi confirmada como realizada.'
        else 'A ocorrência foi atribuída à plataforma e não contará para responsabilização profissional.'
      end,
      '/terapeuta/sessoes/' || v_booking.id::text,
      'attendance-resolution:' || v_incident.id::text || ':therapist'
    )
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  perform public.record_admin_audit_event_v1(
    v_actor_id, 'admin', 'admin.sessions.manage',
    'session_attendance_incident.resolve', 'session_confirmation_incident',
    v_incident.id::text,
    jsonb_build_object('classification', v_incident.classification, 'status', v_incident.status),
    jsonb_build_object('resolution', p_resolution),
    btrim(p_reason), p_request_id::text, null, 'session_attendance'
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'incidentId', v_incident.id,
    'bookingId', v_incident.booking_id,
    'paymentId', v_payment.id,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'resolution', p_resolution,
    'reschedule', v_reschedule,
    'requiresProviderRefund', p_resolution in ('refund', 'platform_refund'),
    'retentionAuthorized', v_incident.retention_authorized
  );
end;
$$;

-- The existing V10 refund command may consume an attendance decision that is
-- already holding the payment. It briefly releases only the local claim guard;
-- claim_full_session_refund_v10_v2 immediately restores the refund block.
create or replace function public.claim_full_session_refund_v10_v3(
  p_actor_user_id uuid,
  p_session_payment_id uuid,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_authorized_review boolean;
  v_platform_responsibility boolean;
  v_result jsonb;
begin
  perform 1 from public.session_payments where id = p_session_payment_id for update;
  select exists (
    select 1
    from public.session_confirmation_incidents as incident
    where incident.session_payment_id = p_session_payment_id
      and incident.operational_resolution = 'refund'
      and incident.financial_resolution = 'refund_pending'
      and incident.resolved_by_user_id = p_actor_user_id
  ) or exists (
    select 1
    from public.booking_reschedule_requests as request
    join public.session_payments as payment on payment.booking_id = request.booking_id
    where payment.id = p_session_payment_id
      and request.status = 'pending_admin_review'
      and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
  ) into v_authorized_review;

  select exists (
    select 1
    from public.session_confirmation_incidents as incident
    where incident.session_payment_id = p_session_payment_id
      and incident.operational_resolution = 'refund'
      and incident.financial_resolution = 'refund_pending'
      and incident.responsibility = 'platform'
  ) into v_platform_responsibility;

  select actor_user_id into v_actor
  from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if v_actor is not null and v_actor <> p_actor_user_id then
    raise exception 'FULL_REFUND_DECISION_ALREADY_EXISTS' using errcode = '23505';
  end if;
  if v_authorized_review and v_actor is null then
    update public.session_payments
    set refund_pending = false, admin_blocked_at = null, updated_at = now()
    where id = p_session_payment_id;
  end if;
  v_result := public.claim_full_session_refund_v10_v2(
    p_actor_user_id, p_session_payment_id, p_request_id, p_reason
  );

  -- A platform-attributed failure is refunded at TES expense. Keep any
  -- therapist Transfer intact and make the generic command skip Reversal and
  -- debt creation for this decision.
  if v_platform_responsibility then
    update public.session_refund_decisions_v10
    set therapist_exposure_cents = 0,
        stripe_transfer_id = null,
        reversal_state = 'not_needed',
        updated_at = now()
    where session_payment_id = p_session_payment_id;

    v_result := jsonb_set(v_result, '{transferId}', 'null'::jsonb, true);
    v_result := jsonb_set(v_result, '{reversalState}', '"not_needed"'::jsonb, true);
  end if;

  return v_result;
end;
$$;

create or replace function public.finalize_attendance_refund_financials_v1(
  p_session_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_incident public.session_confirmation_incidents%rowtype;
  v_policy public.financial_policy_versions%rowtype;
  v_debt public.therapist_financial_debts%rowtype;
  v_fee_debt public.therapist_financial_debts%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_refunded integer;
  v_ledger_id uuid;
begin
  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  select * into v_incident from public.session_confirmation_incidents
  where session_payment_id = p_session_payment_id
    and operational_resolution = 'refund'
  order by resolved_at desc nulls last limit 1 for update;
  if not found then return jsonb_build_object('status', 'no_attendance_incident'); end if;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  where booking.id = v_payment.booking_id;

  select coalesce(sum(refund.amount_cents), 0) into v_refunded
  from public.session_refunds as refund
  where refund.session_payment_id = p_session_payment_id and refund.status = 'succeeded';
  if v_refunded <> v_payment.gross_amount_cents then
    return jsonb_build_object('status', 'awaiting_full_refund');
  end if;

  select * into v_debt from public.therapist_financial_debts
  where session_payment_id = p_session_payment_id
    and origin in ('attendance_transfer_recovery', 'refund')
  order by (origin = 'attendance_transfer_recovery') desc
  limit 1
  for update;
  if found and v_debt.origin = 'refund' then
    update public.therapist_financial_debts
    set origin = 'attendance_transfer_recovery',
        session_confirmation_incident_id = v_incident.id,
        reason_code = 'attendance_transfer_not_recovered',
        metadata = metadata || jsonb_build_object('attendanceIncidentId', v_incident.id),
        updated_at = now()
    where id = v_debt.id;
  end if;

  select * into v_policy from public.financial_policy_versions
  where id = v_payment.policy_version_id;
  if v_incident.classification = 'no_show_therapist'
    and v_incident.responsibility = 'therapist'
    and v_incident.processing_cost_recovery_authorized
    and v_policy.policy_key = 'tes-payments-v11-attendance-accountability'
    and v_policy.metadata ->> 'legalActivation' = 'approved'
    and v_payment.stripe_fee_amount_cents is not null
    and v_payment.stripe_fee_amount_cents > 0
  then
    insert into public.therapist_financial_debts (
      therapist_profile_id, session_payment_id,
      session_confirmation_incident_id, origin, reason_code,
      principal_amount_cents, open_amount_cents, metadata
    ) values (
      v_payment.therapist_profile_id, v_payment.id, v_incident.id,
      'attendance_processing_cost', 'reconciled_processing_cost',
      v_payment.stripe_fee_amount_cents, v_payment.stripe_fee_amount_cents,
      jsonb_build_object('attendanceIncidentId', v_incident.id,
        'policyKey', v_policy.policy_key)
    )
    on conflict (session_payment_id, session_confirmation_incident_id, origin)
      where session_payment_id is not null
        and session_confirmation_incident_id is not null
        and origin in ('attendance_transfer_recovery', 'attendance_processing_cost')
    do nothing
    returning * into v_fee_debt;

    if v_fee_debt.id is not null then
      insert into public.financial_ledger_entries (
        entry_type, direction, currency, amount_cents, therapist_profile_id,
        booking_id, session_payment_id, financial_policy_version_id,
        therapist_financial_debt_id, source_table, source_id, occurred_at
      ) values (
        'therapist_debt', 'debit', 'BRL', v_fee_debt.principal_amount_cents,
        v_payment.therapist_profile_id, v_payment.booking_id, v_payment.id,
        v_payment.policy_version_id, v_fee_debt.id,
        'therapist_financial_debts', v_fee_debt.id, now()
      ) returning id into v_ledger_id;
      insert into public.therapist_financial_debt_events (
        therapist_financial_debt_id, event_type, direction, amount_cents,
        idempotency_key, financial_ledger_entry_id
      ) values (
        v_fee_debt.id, 'created', 'increase', v_fee_debt.principal_amount_cents,
        'tes:attendance-processing-cost:' || v_fee_debt.id::text, v_ledger_id
      );
    end if;
  end if;

  update public.session_confirmation_incidents
  set financial_resolution = 'refunded', updated_at = now()
  where id = v_incident.id;

  insert into public.notifications (profile_id, kind, title, body, href, event_key)
  values
    (v_patient_user_id, 'session_attendance_refund_completed_patient',
      'Reembolso concluído',
      'O reembolso integral do encontro foi concluído.',
      '/app/encontros/' || v_payment.booking_id::text,
      'attendance-refund-completed:' || v_incident.id::text || ':patient'),
    (v_therapist_user_id, 'session_attendance_refund_completed_therapist',
      'Análise financeira concluída',
      'O reembolso da sessão foi concluído. Consulte o Financeiro para acompanhar os registros.',
      '/terapeuta/sessoes/' || v_payment.booking_id::text,
      'attendance-refund-completed:' || v_incident.id::text || ':therapist')
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  return jsonb_build_object(
    'status', 'refunded',
    'transferDebtCents', coalesce(v_debt.open_amount_cents, 0),
    'processingCostDebtCents', coalesce(v_fee_debt.open_amount_cents, 0)
  );
end;
$$;

create or replace function public.get_therapist_attendance_recurrence_v1(
  p_therapist_profile_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_90 integer;
  v_180 integer;
  v_suggestion text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid()
      and role = 'admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null
  ) then
    raise exception 'SESSION_ATTENDANCE_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  select count(*) filter (where incident.resolved_at >= p_now - interval '90 days'),
    count(*) filter (where incident.resolved_at >= p_now - interval '180 days')
  into v_90, v_180
  from public.session_confirmation_incidents as incident
  join public.bookings as booking on booking.id = incident.booking_id
  where booking.therapist_profile_id = p_therapist_profile_id
    and incident.responsibility = 'therapist'
    and incident.status = 'not_performed_confirmed';
  v_suggestion := case
    when v_180 >= 3 then 'review_suspension'
    when v_90 >= 2 then 'review_booking_block'
    when v_90 >= 1 then 'formal_warning'
    else 'none'
  end;
  return jsonb_build_object(
    'confirmedIncidents90Days', v_90,
    'confirmedIncidents180Days', v_180,
    'suggestion', v_suggestion,
    'automaticAction', false
  );
end;
$$;

-- Keep the administrative payout projection compatible with historical V9
-- batches and current V10 direct Transfers while exposing the attendance hold.
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
        and transfer.status = 'transferred'
        then 'needs_review'
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
        or transfer.status in ('pending', 'creating')
        then 'processing'
      else 'processing'
    end,
    'financial_review_status', case
      when exists (
        select 1
        from public.session_confirmation_incidents as incident
        where incident.session_payment_id = payment.id
          and incident.status = 'open'
          and incident.classification in (
            'no_show_therapist', 'no_show_both', 'requires_review'
          )
      ) then 'attendance_review'
      when exists (
        select 1
        from public.booking_reschedule_requests as request
        where request.booking_id = payment.booking_id
          and request.status = 'pending_admin_review'
          and request.change_kind in (
            'therapist_reschedule', 'therapist_cancellation'
          )
      ) then 'therapist_change_refund_review'
      else null
    end,
    'debt_offset_amount_cents', coalesce(
      nullif(job.debt_offset_amount_cents, 0),
      nullif(transfer.debt_offset_amount_cents, 0)
    ),
    'transfer_effective_amount_cents', coalesce(
      job.transfer_amount_cents,
      transfer.amount_cents
    ),
    'bank_paid_at', paid_payout.paid_at
  ))
  from public.session_payments as payment
  left join public.session_transfer_jobs as job
    on job.session_payment_id = payment.id
  left join lateral (
    select candidate.*
    from public.stripe_transfers as candidate
    where candidate.session_payment_id = payment.id
    order by
      (candidate.id = job.stripe_transfer_id) desc,
      coalesce(candidate.transferred_at, candidate.created_at) desc,
      candidate.id desc
    limit 1
  ) as transfer on true
  left join lateral (
    select coalesce(sum(debt.open_amount_cents), 0)::integer
      as open_amount_cents
    from public.therapist_financial_debts as debt
    where debt.session_payment_id = payment.id
      and debt.status = 'open'
      and debt.open_amount_cents > 0
  ) as open_debt on true
  left join lateral (
    select payout.id, payout.paid_at
    from public.stripe_payout_transfer_allocations as allocation
    join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
      and allocation.amount_cents = transfer.amount_cents
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
    order by payout.paid_at desc nulls last, payout.id desc
    limit 1
  ) as paid_payout on true
  where payment.id = p_session_payment_id
    and (job.id is not null or transfer.id is not null);
$$;

-- An open attendance review blocks money, not the counterpart's independent
-- report. Validate the payload before financial eligibility and continue to
-- accept one immutable response from each authenticated participant.
create or replace function public.submit_session_feedback_for_actor_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_outcome text,
  p_rating smallint,
  p_not_performed_reason text,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_existing public.session_feedback;
  v_feedback public.session_feedback;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_hash text;
  v_confirmation jsonb;
  v_participant_confirmation public.session_participant_confirmations;
  v_ends_at timestamptz;
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null
    or p_outcome not in ('completed', 'not_performed')
    or char_length(v_comment) > 500
  then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if p_outcome = 'completed' then
    if p_rating is null or p_rating not between 1 and 5
      or p_not_performed_reason is not null then
      raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
    end if;
  elsif p_rating is not null
    or p_not_performed_reason is null
    or p_not_performed_reason not in (
      'patient_absent', 'therapist_absent', 'internet_problem',
      'audio_video_problem', 'rescheduled', 'late_cancellation', 'other'
    ) then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select case
      when patient.user_id = p_actor_user_id then 'patient'::public.user_role
      when therapist.user_id = p_actor_user_id then 'therapist'::public.user_role
      else null
    end,
    booking.ends_at
  into v_actor_role, v_ends_at
  from public.bookings as booking
  left join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  left join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;
  if now() < v_ends_at then
    raise exception 'FEEDBACK_SESSION_NOT_ENDED' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.session_payments as payment
    where payment.booking_id = p_booking_id
      and payment.financial_status in ('paid', 'partially_refunded')
      and payment.refund_pending = false
      and payment.disputed_at is null
  ) then
    raise exception 'FEEDBACK_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome,
        coalesce(p_rating::text, ''), coalesce(p_not_performed_reason, ''),
        v_comment),
      'sha256'
    ),
    'hex'
  );

  select feedback.* into v_existing
  from public.session_feedback as feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'confirmation', public.session_feedback_confirmation_payload(
        p_booking_id, v_actor_role
      ),
      'feedback', public.session_feedback_payload(v_existing),
      'idempotentReplay', true
    );
  end if;

  insert into public.session_feedback (
    author_profile_id, author_role, booking_id, comment,
    not_performed_reason, outcome, payload_hash, rating, request_id
  ) values (
    p_actor_user_id, v_actor_role, p_booking_id, v_comment,
    p_not_performed_reason, p_outcome, v_hash, p_rating, p_request_id
  )
  returning * into v_feedback;

  select confirmation.* into v_participant_confirmation
  from public.session_participant_confirmations as confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = v_actor_role
  for update;

  if v_participant_confirmation.id is null then
    v_confirmation := public.record_session_participant_confirmation_v1(
      p_actor_user_id, p_booking_id, p_outcome, p_request_id, 'manual', now()
    );
  else
    v_confirmation := jsonb_build_object(
      'confirmation', jsonb_build_object(
        'confirmedAt', v_participant_confirmation.confirmed_at,
        'dueAt', v_participant_confirmation.due_at,
        'outcome', v_participant_confirmation.outcome,
        'source', v_participant_confirmation.source
      ),
      'idempotentReplay', true
    );
  end if;

  if p_outcome = 'completed' then
    perform public.finalize_bilateral_session_confirmation_v1(p_booking_id, now());
  else
    update public.session_payments
    set service_status = 'not_performed',
        service_confirmed_at = null,
        service_confirmation_source = null,
        eligible_at = null,
        transfer_status = case
          when transfer_status in ('batched', 'transfer_pending', 'transferred')
            then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'participant_reported_not_performed',
        internal_contested_at = coalesce(internal_contested_at, now()),
        updated_at = now()
    where booking_id = p_booking_id
      and transfer_status <> 'transferred';
  end if;

  return jsonb_build_object(
    'confirmation', v_confirmation -> 'confirmation',
    'feedback', public.session_feedback_payload(v_feedback),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select feedback.* into v_existing
    from public.session_feedback as feedback
    where feedback.booking_id = p_booking_id
      and feedback.author_role = v_actor_role
    limit 1;
    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'confirmation', public.session_feedback_confirmation_payload(
          p_booking_id, v_actor_role
        ),
        'feedback', public.session_feedback_payload(v_existing),
        'idempotentReplay', true
      );
    end if;
    raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

-- The attendance trigger also sets admin_blocked_at. A performed resolution
-- must release both local fences before the canonical confirmation function
-- can run; a not-performed resolution keeps them in place.
create or replace function public.admin_resolve_session_confirmation_incident_v1(
  p_booking_id uuid,
  p_decision text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_incident public.session_confirmation_incidents%rowtype;
  v_payment public.session_payments%rowtype;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin'::public.user_role
  ) then
    raise exception 'SESSION_INCIDENT_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_booking_id is null or p_request_id is null
    or p_decision not in ('performed_confirmed', 'not_performed_confirmed')
    or length(btrim(coalesce(p_reason, ''))) < 5
    or length(btrim(coalesce(p_reason, ''))) > 1000 then
    raise exception 'SESSION_INCIDENT_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_incident
  from public.session_confirmation_incidents
  where booking_id = p_booking_id
  order by booking_version desc, created_at desc
  limit 1
  for update;
  if not found then raise exception 'SESSION_INCIDENT_NOT_FOUND'; end if;
  if v_incident.resolution_request_id = p_request_id then
    return jsonb_build_object(
      'idempotentReplay', true, 'status', v_incident.status
    );
  end if;
  if v_incident.status <> 'open' then
    raise exception 'SESSION_INCIDENT_ALREADY_RESOLVED';
  end if;

  select * into v_payment from public.session_payments
  where booking_id = p_booking_id for update;

  update public.session_confirmation_incidents
  set status = p_decision,
      resolution_reason = btrim(p_reason),
      resolved_by_user_id = v_actor_id,
      resolution_request_id = p_request_id,
      resolved_at = now(),
      updated_at = now()
  where id = v_incident.id;

  if p_decision = 'performed_confirmed' then
    update public.session_payments
    set internal_contested_at = null,
        admin_blocked_at = null,
        transfer_blocked_reason = null,
        updated_at = now()
    where id = v_payment.id;

    perform public.confirm_session_service(
      p_booking_id,
      'admin'::public.session_confirmation_source,
      v_actor_id,
      null,
      jsonb_build_object(
        'confirmationModel', 'admin_incident_resolution',
        'incidentId', v_incident.id,
        'confirmedAt', now(),
        'reason', btrim(p_reason)
      )
    );
  else
    update public.session_payments
    set service_status = 'not_performed',
        transfer_status = case
          when transfer_status in ('batched', 'transfer_pending', 'transferred')
            then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'not_performed_confirmed_by_admin',
        internal_contested_at = coalesce(internal_contested_at, now()),
        admin_blocked_at = coalesce(admin_blocked_at, now()),
        updated_at = now()
    where id = v_payment.id;
  end if;

  perform public.record_admin_audit_event_v1(
    v_actor_id, 'admin', 'admin.sessions.manage',
    'session_confirmation_incident.resolve',
    'session_confirmation_incident', v_incident.id::text,
    jsonb_build_object('status', v_incident.status),
    jsonb_build_object('status', p_decision),
    btrim(p_reason), p_request_id::text, null, 'session_confirmation'
  );

  return jsonb_build_object(
    'idempotentReplay', false, 'status', p_decision
  );
end;
$$;

revoke all on function public.admin_resolve_session_attendance_v1(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.admin_resolve_session_attendance_v1(uuid, text, text, uuid)
  to authenticated, service_role;
revoke all on function public.claim_full_session_refund_v10_v3(uuid, uuid, text, text),
  public.finalize_attendance_refund_financials_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_full_session_refund_v10_v3(uuid, uuid, text, text),
  public.finalize_attendance_refund_financials_v1(uuid)
  to service_role;
revoke all on function public.get_therapist_attendance_recurrence_v1(uuid, timestamptz)
  from public, anon;
grant execute on function public.get_therapist_attendance_recurrence_v1(uuid, timestamptz)
  to authenticated, service_role;
