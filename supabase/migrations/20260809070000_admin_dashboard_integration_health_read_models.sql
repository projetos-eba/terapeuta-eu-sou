-- Admin dashboard and integration health read models.
--
-- These RPCs replace horizontal REST counts from the admin shell with
-- explicit, minimized and sanitized administrative DTOs. They validate the
-- authenticated admin actor server-side and never expose provider secrets,
-- raw payloads, metadata, URLs or external Stripe/Zoom identifiers.

create or replace function public.admin_get_integration_health_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_signals jsonb;
  v_last jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'failed-stripe-webhooks', (
      select count(*)::integer
      from public.stripe_webhook_events
      where stripe_webhook_events.processing_status::text = 'failed'
    ),
    'processing-stripe-webhooks', (
      select count(*)::integer
      from public.stripe_webhook_events
      where stripe_webhook_events.processing_status::text in (
        'received',
        'processing'
      )
    ),
    'attention-subscriptions', (
      select count(*)::integer
      from public.therapist_subscriptions
      where therapist_subscriptions.status::text in (
        'past_due',
        'unpaid',
        'incomplete'
      )
    ),
    'pending-session-payments', (
      select count(*)::integer
      from public.session_payments
      where session_payments.financial_status::text in (
        'pending',
        'processing'
      )
    ),
    'restricted-connect-accounts', (
      select count(*)::integer
      from public.therapist_connect_accounts
      where therapist_connect_accounts.operational_status <> 'active'
    ),
    'failed-zoom-webhooks', (
      select count(*)::integer
      from public.zoom_video_webhook_events
      where zoom_video_webhook_events.processing_status::text = 'failed'
    ),
    'processing-zoom-webhooks', (
      select count(*)::integer
      from public.zoom_video_webhook_events
      where zoom_video_webhook_events.processing_status::text in (
        'received',
        'processing'
      )
    ),
    'failed-video-sessions', (
      select count(*)::integer
      from public.video_sessions
      where video_sessions.status::text = 'failed'
    ),
    'failed-emails', (
      select count(*)::integer
      from public.email_delivery_logs
      where email_delivery_logs.status::text = 'error'
    )
  )
  into v_signals;

  select jsonb_build_object(
    'stripeWebhookAt', (
      select max(stripe_webhook_events.received_at)
      from public.stripe_webhook_events
    ),
    'zoomWebhookAt', (
      select max(zoom_video_webhook_events.created_at)
      from public.zoom_video_webhook_events
    ),
    'emailDeliveryAt', (
      select max(email_delivery_logs.created_at)
      from public.email_delivery_logs
    ),
    'connectSyncAt', (
      select max(therapist_connect_accounts.last_synced_at)
      from public.therapist_connect_accounts
    )
  )
  into v_last;

  return jsonb_build_object(
    'generatedAt', now(),
    'signals', v_signals,
    'last', v_last
  );
end;
$$;

revoke all on function public.admin_get_integration_health_v1()
from public, anon, authenticated, service_role;

grant execute on function public.admin_get_integration_health_v1()
to authenticated, service_role;

comment on function public.admin_get_integration_health_v1() is
  'Sanitized admin-only integration health read model. Returns aggregate Stripe, Connect, Zoom and email signals without secrets, payloads, URLs or provider object IDs.';

create or replace function public.admin_get_dashboard_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_metrics jsonb;
  v_events jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'published-therapies', (
      select count(*)::integer
      from public.therapies
      where therapies.status::text in ('active', 'published')
        and therapies.is_public_visible is true
    ),
    'draft-therapies', (
      select count(*)::integer
      from public.therapies
      where therapies.status::text in ('draft', 'inactive')
        or therapies.is_public_visible is false
    ),
    'matching-visible-therapies', (
      select count(*)::integer
      from public.therapies
      join public.matching_therapy_settings
        on matching_therapy_settings.therapy_id = therapies.id
      where therapies.status::text in ('active', 'published')
        and therapies.is_public_visible is true
        and matching_therapy_settings.is_visible_in_matching is true
    ),
    'pending-therapy-requests', (
      select count(*)::integer
      from public.therapy_catalog_requests
      where therapy_catalog_requests.status in (
        'submitted',
        'under_review',
        'needs_information'
      )
    ),
    'active-therapists', (
      select count(*)::integer
      from public.therapist_profiles
      where therapist_profiles.status::text = 'approved'
    ),
    'pending-therapists', (
      select count(*)::integer
      from public.therapist_profiles
      where therapist_profiles.status::text in (
        'draft',
        'submitted',
        'in_review'
      )
    ),
    'active-patients', (
      select count(*)::integer
      from public.patient_profiles
    ),
    'future-sessions', (
      select count(*)::integer
      from public.bookings
      where bookings.starts_at >= now()
    ),
    'attention-sessions', (
      select count(*)::integer
      from public.bookings
      where bookings.status::text in (
        'pending_payment',
        'no_show_patient',
        'no_show_therapist',
        'refunded'
      )
    ),
    'open-support-tickets', (
      select count(*)::integer
      from public.support_tickets
      where support_tickets.status = 'open'
    ),
    'pending-session-payments', (
      select count(*)::integer
      from public.session_payments
      where session_payments.financial_status::text in (
        'pending',
        'processing'
      )
    ),
    'paid-session-payments', (
      select count(*)::integer
      from public.session_payments
      where session_payments.financial_status::text in (
        'paid',
        'partially_refunded'
      )
    ),
    'pending-refunds', (
      select count(*)::integer
      from public.session_refunds
      where session_refunds.status = 'pending'
    ),
    'open-disputes', (
      select count(*)::integer
      from public.session_disputes
      where session_disputes.closed_at is null
    ),
    'open-payout-batches', (
      select count(*)::integer
      from public.payout_batches
      where payout_batches.status::text in (
        'draft',
        'open',
        'processing',
        'partially_failed'
      )
    ),
    'active-subscriptions', (
      select count(*)::integer
      from public.therapist_subscriptions
      where therapist_subscriptions.status::text in ('trialing', 'active')
    ),
    'attention-subscriptions', (
      select count(*)::integer
      from public.therapist_subscriptions
      where therapist_subscriptions.status::text in (
        'past_due',
        'unpaid',
        'incomplete'
      )
    ),
    'failed-webhooks', (
      select count(*)::integer
      from public.stripe_webhook_events
      where stripe_webhook_events.processing_status::text = 'failed'
    ),
    'failed-zoom-webhooks', (
      select count(*)::integer
      from public.zoom_video_webhook_events
      where zoom_video_webhook_events.processing_status::text = 'failed'
    ),
    'failed-video-sessions', (
      select count(*)::integer
      from public.video_sessions
      where video_sessions.status::text = 'failed'
    ),
    'failed-emails', (
      select count(*)::integer
      from public.email_delivery_logs
      where email_delivery_logs.status::text = 'error'
    ),
    'restricted-connect-accounts', (
      select count(*)::integer
      from public.therapist_connect_accounts
      where therapist_connect_accounts.operational_status <> 'active'
    )
  )
  into v_metrics;

  select coalesce(jsonb_agg(event_payload order by created_at desc), '[]'::jsonb)
  into v_events
  from (
    select
      admin_audit_events.created_at,
      jsonb_build_object(
        'id', admin_audit_events.id,
        'actorRole', admin_audit_events.actor_role,
        'entityType', admin_audit_events.entity_type,
        'eventType', admin_audit_events.action,
        'reason', admin_audit_events.reason,
        'createdAt', admin_audit_events.created_at
      ) as event_payload
    from public.admin_audit_events
    order by admin_audit_events.created_at desc
    limit 6
  ) events;

  return jsonb_build_object(
    'generatedAt', now(),
    'metrics', v_metrics,
    'events', v_events
  );
end;
$$;

revoke all on function public.admin_get_dashboard_v1()
from public, anon, authenticated, service_role;

grant execute on function public.admin_get_dashboard_v1()
to authenticated, service_role;

comment on function public.admin_get_dashboard_v1() is
  'Sanitized admin-only dashboard read model. Returns aggregate operational, catalog, finance and integration counts plus safe audit event summaries.';
