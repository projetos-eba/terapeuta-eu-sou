begin;

create or replace function public.payout_incident_admin_notification_v2(
  p_incident_type text,
  p_status text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_title text := 'Repasse exige atenção';
  v_body text := 'Uma ocorrência financeira precisa de revisão administrativa.';
  v_href text := '/admin/pagamentos';
  v_payment_id text := p_metadata ->> 'sessionPaymentId';
begin
  if p_status = 'resolved' then
    return jsonb_build_object(
      'title', 'Ocorrência de repasse resolvida',
      'body', 'Esta ocorrência financeira foi revisada.',
      'href', v_href
    );
  end if;

  if p_incident_type = 'automatic_payout_reconciliation_required' then
    v_title := 'Conciliação de repasse exige atenção';
    v_body := 'Um depósito precisa de conferência antes de ser marcado como recebido.';
  elsif p_incident_type = 'session_direct_transfer_attention' then
    v_title := 'Repasse de sessão exige atenção';
    v_body := 'A transferência desta sessão precisa de conferência.';
    if v_payment_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_href := '/admin/pagamentos/' || v_payment_id;
    end if;
  elsif p_incident_type = 'transfer_blocked' then
    v_title := 'Repasse não concluído';
    v_body := 'Uma transferência precisa de revisão antes de continuar.';
  end if;

  return jsonb_build_object('title', v_title, 'body', v_body, 'href', v_href);
end;
$$;

revoke all on function public.payout_incident_admin_notification_v2(text,text,jsonb)
  from public, anon, authenticated;

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
begin
  v_message := public.payout_incident_admin_notification_v2(
    new.incident_type, new.status::text, new.metadata
  );
  for v_admin in
    select profile.* from public.profiles profile
    where profile.role = 'admin' and nullif(trim(profile.email), '') is not null
      and profile.auth_deleted_at is null and profile.anonymized_at is null
  loop
    v_count := v_count + 1;
    perform public.enqueue_transactional_email_v1(
      'payout_operational_alert_admin', new.id,
      'payout_operational_incident', new.id, v_admin.id,
      'profile:' || v_admin.id::text, '{}'::jsonb
    );
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      v_admin.id, 'payout_operational_alert_admin',
      v_message ->> 'title', v_message ->> 'body', v_message ->> 'href',
      'payout_incident:' || new.id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
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
      read_at = case when new.status = 'open' then null else read_at end
  where kind = 'payout_operational_alert_admin'
    and event_key = 'payout_incident:' || new.id::text;
  return new;
end;
$$;

drop trigger if exists refresh_payout_incident_admin_notifications_v2
  on public.payout_operational_incidents;
create trigger refresh_payout_incident_admin_notifications_v2
after update of status on public.payout_operational_incidents
for each row execute function public.refresh_payout_incident_admin_notifications_v2();

revoke all on function public.refresh_payout_incident_admin_notifications_v2()
  from public, anon, authenticated;

-- Preserve the event history while replacing misleading generic text in
-- existing administrative notifications with the incident's current state.
update public.notifications as notification
set title = message.value ->> 'title',
    body = message.value ->> 'body',
    href = message.value ->> 'href'
from public.payout_operational_incidents as incident
cross join lateral (
  select public.payout_incident_admin_notification_v2(
    incident.incident_type, incident.status::text, incident.metadata
  ) as value
) as message
where notification.kind = 'payout_operational_alert_admin'
  and notification.event_key = 'payout_incident:' || incident.id::text;

commit;
