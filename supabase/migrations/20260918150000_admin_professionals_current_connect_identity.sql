-- The Connect lifecycle deliberately preserves retired accounts so Transfer,
-- payout and closure reconciliation retain their historical references. The
-- Admin professionals list is an operational projection and must represent a
-- therapist once, using only its current receiving account.

alter function public.admin_get_operation_module_v1_internal(text, integer, integer)
  rename to admin_get_operation_module_v1_internal_before_professional_identity;

create function public.admin_get_operation_module_v1_internal(
  p_module text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
begin
  -- Keep the existing authorization, metrics and every non-professionals
  -- module unchanged. The predecessor remains the authorization boundary.
  v_base := public.admin_get_operation_module_v1_internal_before_professional_identity(
    p_module,
    p_limit,
    p_offset
  );

  if p_module is distinct from 'professionals' then
    return v_base;
  end if;

  select coalesce(jsonb_agg(row_payload order by updated_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      therapist.updated_at,
      jsonb_build_object(
        'id', therapist.id,
        'public_name', therapist.public_name,
        'email', person.email,
        'photo_url', therapist.photo_url,
        'slug', therapist.slug,
        'plan', therapist.plan,
        'status', therapist.status,
        'public_status', therapist.public_status,
        'is_public', therapist.is_public,
        'is_accepting_bookings', therapist.is_accepting_bookings,
        'service_count', coalesce(service_counts.total, 0),
        'connect_status', current_account.operational_status,
        'next_session_at', next_booking.starts_at,
        'created_at', therapist.created_at,
        'updated_at', therapist.updated_at
      ) as row_payload
    from public.therapist_profiles as therapist
    left join public.profiles as person
      on person.id = therapist.user_id
    left join lateral (
      select count(*)::integer as total
      from public.therapist_services as service
      where service.therapist_profile_id = therapist.id
        and service.archived_at is null
    ) as service_counts on true
    left join public.therapist_connect_accounts as current_account
      on current_account.therapist_profile_id = therapist.id
      and current_account.is_current
    left join lateral (
      select booking.starts_at
      from public.bookings as booking
      where booking.therapist_profile_id = therapist.id
        and booking.starts_at >= now()
        and booking.status not in (
          'cancelled_by_patient'::public.booking_status,
          'cancelled_by_therapist'::public.booking_status,
          'refunded'::public.booking_status
        )
      order by booking.starts_at asc
      limit 1
    ) as next_booking on true
    order by therapist.updated_at desc
    limit v_limit offset v_offset
  ) as rows;

  return jsonb_set(v_base, '{rows}', v_rows);
end;
$$;

revoke all on function public.admin_get_operation_module_v1_internal_before_professional_identity(
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

revoke all on function public.admin_get_operation_module_v1_internal(
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

comment on function public.admin_get_operation_module_v1_internal(text, integer, integer) is
  'Internal source for the Admin operation read model. Professionals are projected once per therapist profile, with only the current Connect account and allowlisted Admin identity fields.';
