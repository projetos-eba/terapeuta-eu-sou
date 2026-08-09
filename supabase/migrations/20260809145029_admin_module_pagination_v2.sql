-- Admin module paginated read-model contracts.
--
-- v2 keeps v1 intact and adds a stable query/page envelope consumed by the
-- admin shell. Filtering and pagination happen server-side over already
-- minimized DTOs; no browser route reads canonical tables horizontally.

create or replace function public.admin_filter_jsonb_read_model_rows_v1(
  p_rows jsonb,
  p_search text,
  p_status text,
  p_sort text,
  p_page integer,
  p_page_size integer
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with source_rows as (
    select value as row_payload
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as source(value)
  ),
  filtered_rows as (
    select row_payload
    from source_rows
    where (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or lower(row_payload::text) like
          '%' || lower(nullif(btrim(coalesce(p_search, '')), '')) || '%'
      )
      and (
        nullif(btrim(coalesce(p_status, '')), '') is null
        or row_payload ->> 'status' = nullif(btrim(coalesce(p_status, '')), '')
        or row_payload ->> 'account_status' =
          nullif(btrim(coalesce(p_status, '')), '')
        or row_payload ->> 'financial_status' =
          nullif(btrim(coalesce(p_status, '')), '')
      )
  ),
  numbered_rows as (
    select
      row_payload,
      count(*) over ()::integer as total,
      row_number() over (
        order by
          case
            when coalesce(p_sort, 'recent') = 'name' then lower(coalesce(
              row_payload ->> 'public_name',
              row_payload ->> 'display_name',
              row_payload ->> 'therapist_name',
              row_payload ->> 'subject',
              row_payload ->> 'service_title',
              row_payload ->> 'plan_name',
              ''
            ))
          end asc nulls last,
          case
            when coalesce(p_sort, 'recent') = 'status' then lower(coalesce(
              row_payload ->> 'status',
              row_payload ->> 'account_status',
              row_payload ->> 'financial_status',
              ''
            ))
          end asc nulls last,
          case
            when coalesce(p_sort, 'recent') = 'amount' then
              nullif(row_payload ->> 'gross_amount_cents', '')::integer
          end desc nulls last,
          case
            when coalesce(p_sort, 'recent') = 'oldest' then coalesce(
              row_payload ->> 'created_at',
              row_payload ->> 'submitted_at',
              row_payload ->> 'starts_at',
              row_payload ->> 'updated_at',
              ''
            )
          end asc nulls last,
          coalesce(
            row_payload ->> 'updated_at',
            row_payload ->> 'created_at',
            row_payload ->> 'submitted_at',
            row_payload ->> 'starts_at',
            ''
          ) desc nulls last
      )::integer as row_number
    from filtered_rows
  ),
  page_rows as (
    select row_payload, row_number, total
    from numbered_rows
    where row_number > greatest((p_page - 1) * p_page_size, 0)
      and row_number <= greatest((p_page - 1) * p_page_size, 0) + p_page_size
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(page_rows.row_payload order by page_rows.row_number),
      '[]'::jsonb
    ),
    'total', coalesce(max(page_rows.total), (select count(*)::integer from filtered_rows))
  )
  from page_rows;
$$;

create or replace function public.admin_get_operation_module_v2(
  p_module text,
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_filtered jsonb;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := nullif(btrim(coalesce(p_query ->> 'sort', 'recent')), '');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_total integer := 0;
begin
  if v_page_text ~ '^[0-9]+$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;

  if v_page_size_text ~ '^[0-9]+$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  v_base := public.admin_get_operation_module_v1(p_module, 50, 0);

  v_filtered := public.admin_filter_jsonb_read_model_rows_v1(
    v_base -> 'rows',
    v_search,
    v_status,
    coalesce(v_sort, 'recent'),
    v_page,
    v_page_size
  );
  v_total := coalesce((v_filtered ->> 'total')::integer, 0);

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'search', v_search,
      'sort', coalesce(v_sort, 'recent'),
      'status', v_status
    ),
    'generatedAt', coalesce(v_base -> 'generatedAt', to_jsonb(now())),
    'metrics', coalesce(v_base -> 'metrics', '{}'::jsonb),
    'module', p_module,
    'page', jsonb_build_object(
      'hasNext', (v_page * v_page_size) < v_total,
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total
    ),
    'rows', coalesce(v_filtered -> 'rows', '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_get_finance_module_v2(
  p_module text,
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_base jsonb;
  v_filtered jsonb;
  v_metrics jsonb := '{}'::jsonb;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_rows jsonb := '[]'::jsonb;
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := nullif(btrim(coalesce(p_query ->> 'sort', 'recent')), '');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_total integer := 0;
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

  if v_page_text ~ '^[0-9]+$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;

  if v_page_size_text ~ '^[0-9]+$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  if p_module in ('payments', 'subscriptions') then
    v_base := public.admin_get_finance_module_v1(p_module, 50, 0);
    v_metrics := coalesce(v_base -> 'metrics', '{}'::jsonb);
    v_rows := coalesce(v_base -> 'rows', '[]'::jsonb);
  elsif p_module = 'reports' then
    v_metrics := jsonb_build_object(
      'report-professionals', (
        select count(*)::integer from public.therapist_profiles
      ),
      'report-patients', (
        select count(*)::integer from public.patient_profiles
      ),
      'report-sessions', (
        select count(*)::integer from public.bookings
      ),
      'report-payments', (
        select count(*)::integer from public.session_payments
      ),
      'report-subscriptions', (
        select count(*)::integer from public.therapist_subscriptions
      ),
      'report-stripe-failures', (
        select count(*)::integer
        from public.stripe_webhook_events
        where processing_status::text = 'failed'
      )
    );
    v_rows := jsonb_build_array(
      jsonb_build_object(
        'description', 'Status, publicação, plano e prontidão operacional.',
        'export_status', 'Pendente de comando auditado',
        'id', 'professionals',
        'privacy', 'Mínimo necessário',
        'scope', 'Admin read-only',
        'source', 'therapist_profiles',
        'status', 'planned',
        'title', 'Relatório de profissionais',
        'updated_at', now()
      ),
      jsonb_build_object(
        'description', 'Base de clientes com mínimo operacional, sem conteúdo clínico.',
        'export_status', 'Pendente de comando auditado',
        'id', 'patients',
        'privacy', 'Mínimo necessário',
        'scope', 'Admin read-only',
        'source', 'patient_profiles',
        'status', 'planned',
        'title', 'Relatório de clientes',
        'updated_at', now()
      ),
      jsonb_build_object(
        'description', 'Reservas, estados, janelas e conciliação operacional.',
        'export_status', 'Pendente de comando auditado',
        'id', 'sessions',
        'privacy', 'Mínimo necessário',
        'scope', 'Admin read-only',
        'source', 'bookings',
        'status', 'planned',
        'title', 'Relatório de sessões',
        'updated_at', now()
      ),
      jsonb_build_object(
        'description', 'Pagamentos, refunds, disputes, ledger e repasses.',
        'export_status', 'Pendente de comando auditado',
        'id', 'payments',
        'privacy', 'Mínimo necessário',
        'scope', 'Admin read-only',
        'source', 'session_payments',
        'status', 'planned',
        'title', 'Relatório financeiro',
        'updated_at', now()
      ),
      jsonb_build_object(
        'description', 'Billing de terapeutas, planos e estados de cobrança.',
        'export_status', 'Pendente de comando auditado',
        'id', 'subscriptions',
        'privacy', 'Mínimo necessário',
        'scope', 'Admin read-only',
        'source', 'therapist_subscriptions',
        'status', 'planned',
        'title', 'Relatório de assinaturas',
        'updated_at', now()
      )
    );
  else
    raise exception 'unsupported admin finance module: %', p_module
      using errcode = '22023';
  end if;

  v_filtered := public.admin_filter_jsonb_read_model_rows_v1(
    v_rows,
    v_search,
    v_status,
    coalesce(v_sort, 'recent'),
    v_page,
    v_page_size
  );
  v_total := coalesce((v_filtered ->> 'total')::integer, 0);

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'search', v_search,
      'sort', coalesce(v_sort, 'recent'),
      'status', v_status
    ),
    'generatedAt', now(),
    'metrics', v_metrics,
    'module', p_module,
    'page', jsonb_build_object(
      'hasNext', (v_page * v_page_size) < v_total,
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total
    ),
    'rows', coalesce(v_filtered -> 'rows', '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_filter_jsonb_read_model_rows_v1(
  jsonb,
  text,
  text,
  text,
  integer,
  integer
) from public, anon, authenticated;

revoke all on function public.admin_get_operation_module_v2(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_module_v2(text, jsonb)
  to authenticated, service_role;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_operation_module_v2(text, jsonb) is
  'Paginated admin operation read model. Validates the authenticated admin through v1 and returns sanitized rows with filtersApplied and page metadata.';

comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Paginated admin finance read model. Keeps Stripe/Billing/ledger data read-only and returns sanitized rows with filtersApplied and page metadata.';

create or replace function public.admin_execute_operation_command_v2(
  p_action text,
  p_entity_id uuid,
  p_reason text,
  p_request_id text,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_audit_id uuid;
  v_next jsonb;
  v_previous jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_id text := nullif(btrim(coalesce(p_request_id, '')), '');
begin
  if p_action not in ('verification.pause_review', 'verification.reopen_review') then
    return public.admin_execute_operation_command_v1(
      p_action,
      p_entity_id,
      p_reason,
      p_request_id,
      p_payload,
      p_correlation_id
    );
  end if;

  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if p_entity_id is null then
    raise exception 'admin command entity id required'
      using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 8 then
    raise exception 'admin command reason must have at least 8 characters'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    raise exception 'admin command request_id required'
      using errcode = '22023';
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
    'id', therapist_verifications.id,
    'status', therapist_verifications.status,
    'therapist_profile_id', therapist_verifications.therapist_profile_id
  )
  into v_previous
  from public.therapist_verifications
  where therapist_verifications.id = p_entity_id
  for update;

  if v_previous is null then
    raise exception 'admin command target not found'
      using errcode = 'P0002';
  end if;

  if p_action = 'verification.pause_review' then
    update public.therapist_verifications
    set
      status = 'changes_requested'::public.therapist_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      changes_requested = v_reason,
      updated_at = now()
    where id = p_entity_id;

    update public.therapist_profiles
    set
      status = 'changes_requested'::public.therapist_status,
      is_public = false,
      is_accepting_bookings = false,
      updated_at = now()
    where id = (v_previous ->> 'therapist_profile_id')::uuid
      and status <> 'suspended'::public.therapist_status;
  else
    update public.therapist_verifications
    set
      status = 'in_review'::public.therapist_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
    where id = p_entity_id
      and status in (
        'submitted'::public.therapist_status,
        'changes_requested'::public.therapist_status,
        'rejected'::public.therapist_status
      );

    update public.therapist_profiles
    set
      status = 'in_review'::public.therapist_status,
      updated_at = now()
    where id = (v_previous ->> 'therapist_profile_id')::uuid
      and status <> 'suspended'::public.therapist_status;
  end if;

  select jsonb_build_object(
    'id', therapist_verifications.id,
    'status', therapist_verifications.status,
    'therapist_profile_id', therapist_verifications.therapist_profile_id
  )
  into v_next
  from public.therapist_verifications
  where therapist_verifications.id = p_entity_id;

  v_audit_id := public.record_admin_audit_event_v1(
    v_actor_id,
    'admin',
    'admin.professionals.verify',
    p_action,
    'therapist_verification',
    p_entity_id::text,
    coalesce(v_previous, '{}'::jsonb),
    coalesce(v_next, '{}'::jsonb),
    v_reason,
    v_request_id,
    p_correlation_id,
    'admin-operation-command'
  );

  return jsonb_build_object(
    'auditEventId', v_audit_id,
    'entityId', p_entity_id,
    'entityType', 'therapist_verification',
    'nextState', coalesce(v_next, '{}'::jsonb),
    'ok', true,
    'permission', 'admin.professionals.verify',
    'previousState', coalesce(v_previous, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

comment on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Extends admin operation commands with verification pause/reopen while preserving mandatory reason, request_id and append-only audit.';
