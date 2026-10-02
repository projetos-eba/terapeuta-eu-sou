begin;

alter table public.notifications
  add column if not exists available_at timestamptz not null default now();

create index if not exists notifications_profile_available_unread_idx
  on public.notifications (profile_id, available_at, read_at);

drop policy if exists "Profiles can read their own notifications"
  on public.notifications;
drop policy if exists "Profiles can read own notifications"
  on public.notifications;
create policy "Profiles can read own notifications"
on public.notifications
for select
to authenticated
using (
  profile_id = (select auth.uid())
  and available_at <= now()
);

drop policy if exists "Profiles can update their own notifications"
  on public.notifications;
create policy "Profiles can update their own notifications"
on public.notifications
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and available_at <= now()
)
with check (
  profile_id = (select auth.uid())
  and available_at <= now()
);

-- Reconciliation can briefly open before a near-simultaneous payout.paid
-- event completes the same payout. Keep the incident immediate, but delay both
-- administrator-facing channels so transient convergence does not cause a
-- false alarm. No financial object or existing alert row is backfilled by this
-- migration.
create or replace function public.notify_payout_incident_admins_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.profiles%rowtype;
  v_count integer := 0;
  v_message jsonb;
  v_outbox_id uuid;
begin
  v_message := public.payout_incident_admin_notification_v2(
    new.incident_type, new.status::text, new.metadata
  );

  for v_admin in
    select profile.*
    from public.profiles profile
    where profile.role = 'admin'
      and nullif(trim(profile.email), '') is not null
      and profile.auth_deleted_at is null
      and profile.anonymized_at is null
  loop
    v_count := v_count + 1;
    v_outbox_id := public.enqueue_transactional_email_v1(
      'payout_operational_alert_admin', new.id,
      'payout_operational_incident', new.id, v_admin.id,
      'profile:' || v_admin.id::text, '{}'::jsonb
    );

    if new.incident_type = 'automatic_payout_reconciliation_required'
      and v_outbox_id is not null
    then
      update public.email_outbox
      set next_attempt_at = greatest(
            next_attempt_at,
            new.first_occurred_at + interval '15 minutes'
          )
      where id = v_outbox_id
        and status in ('pending', 'retry_pending');
    end if;

    insert into public.notifications (
      profile_id, kind, title, body, href, event_key, available_at
    ) values (
      v_admin.id, 'payout_operational_alert_admin',
      v_message ->> 'title', v_message ->> 'body', v_message ->> 'href',
      'payout_incident:' || new.id::text,
      case
        when new.incident_type = 'automatic_payout_reconciliation_required'
          then new.first_occurred_at + interval '15 minutes'
        else now()
      end
    ) on conflict (profile_id, event_key)
      where event_key is not null do nothing;
  end loop;

  if v_count = 0 then
    update public.payout_operational_incidents
    set metadata = metadata || '{"admin_recipient_missing":true}'::jsonb,
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.refresh_payout_incident_admin_notifications_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message jsonb;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_message := public.payout_incident_admin_notification_v2(
    new.incident_type, new.status::text, new.metadata
  );

  update public.notifications
  set title = v_message ->> 'title',
      body = v_message ->> 'body',
      href = v_message ->> 'href',
      read_at = case
        when new.status = 'open' then null
        when new.incident_type = 'automatic_payout_reconciliation_required'
          and available_at > now() then coalesce(read_at, now())
        else read_at
      end,
      available_at = case
        when new.incident_type <> 'automatic_payout_reconciliation_required'
          then available_at
        when new.status = 'open'
          then new.last_occurred_at + interval '15 minutes'
        when available_at > now()
          then 'infinity'::timestamptz
        else available_at
      end
  where kind = 'payout_operational_alert_admin'
    and event_key = 'payout_incident:' || new.id::text;

  -- A transiently resolved incident may later reopen. Reuse the same logical
  -- delivery only when it was suppressed before any provider success. The
  -- payload keeps an audit counter while the provider-attempt budget restarts.
  if old.status <> 'open'
    and new.status = 'open'
    and new.incident_type = 'automatic_payout_reconciliation_required'
  then
    update public.email_outbox as outbox
    set next_attempt_at = new.last_occurred_at + interval '15 minutes'
    where outbox.action_key = 'payout_operational_alert_admin'
      and outbox.domain_event_id = new.id
      and outbox.related_entity_type = 'payout_operational_incident'
      and outbox.related_entity_id = new.id
      and outbox.status in ('pending', 'retry_pending');

    update public.email_outbox as outbox
    set status = 'pending',
        attempts = 0,
        next_attempt_at = new.last_occurred_at + interval '15 minutes',
        last_error = null,
        locked_at = null,
        locked_by = null,
        processed_at = null,
        review_required = false,
        review_reason = null,
        payload = outbox.payload || jsonb_build_object(
          'payoutAlertSuppressedCount',
          coalesce((outbox.payload ->> 'payoutAlertSuppressedCount')::integer, 0) + 1,
          'payoutAlertLastSuppressedAt',
          coalesce(outbox.processed_at, now())
        )
    where outbox.action_key = 'payout_operational_alert_admin'
      and outbox.domain_event_id = new.id
      and outbox.related_entity_type = 'payout_operational_incident'
      and outbox.related_entity_id = new.id
      and outbox.status = 'skipped'
      and outbox.last_error = 'payout_incident_resolved_before_alert'
      and not exists (
        select 1
        from public.email_delivery_logs delivery
        where delivery.correlation_id = outbox.id::text
          and delivery.status = 'success'
      );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_payout_incident_admins_v1()
  from public, anon, authenticated;
revoke all on function public.refresh_payout_incident_admin_notifications_v2()
  from public, anon, authenticated;

commit;
