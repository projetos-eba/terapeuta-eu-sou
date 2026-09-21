-- Keep personal contact data inside the existing Admin-only review projection.
-- The phone stays stored in profiles; this does not widen any public view or
-- grant access to a new role.
create or replace function public.admin_get_therapist_profile_review_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.therapist_profiles%rowtype;
  v_content_id uuid;
  v_content jsonb;
  v_verification_status text;
  v_services jsonb;
  v_private_identity jsonb;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id
      and role = 'admin'::public.user_role
      and auth_deleted_at is null
      and anonymized_at is null
  ) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.therapist_profiles
  where id = p_therapist_profile_id;

  if not found then
    raise exception 'profile review target not found' using errcode = 'P0002';
  end if;

  select content.id into v_content_id
  from public.therapist_profile_content_versions content
  where content.therapist_profile_id = v_profile.id
    and content.status = 'published'
  order by content.published_at desc nulls last,
    content.updated_at desc,
    content.created_at desc
  limit 1;

  if v_content_id is not null then
    v_content := public.therapist_profile_content_json_m1(v_content_id);
  end if;

  select status::text into v_verification_status
  from public.therapist_verifications
  where therapist_profile_id = v_profile.id
  order by submitted_at desc nulls last, created_at desc, id desc
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'title', services.title,
      'description', services.description,
      'durationMinutes', services.duration_minutes,
      'priceCents', services.price_cents,
      'currency', services.currency,
      'status', services.status,
      'therapyName', therapies.name
    ) order by services.position, services.created_at
  ), '[]'::jsonb)
  into v_services
  from public.therapist_services services
  left join public.therapies therapies on therapies.id = services.therapy_id
  where services.therapist_profile_id = v_profile.id
    and services.archived_at is null;

  select jsonb_build_object(
    'documentType', identity.document_type,
    'documentNumber', identity.document_number,
    'phone', person.phone,
    'phoneCountryCode', person.phone_country_code,
    'postalCode', identity.postal_code,
    'street', identity.street,
    'streetNumber', identity.street_number,
    'complement', identity.complement,
    'neighborhood', identity.neighborhood,
    'city', identity.city,
    'state', identity.state,
    'country', identity.country
  )
  into v_private_identity
  from public.therapist_private_identity identity
  join public.profiles person on person.id = v_profile.user_id
  where identity.therapist_profile_id = v_profile.id;

  return jsonb_build_object(
    'contentVersionId', v_content ->> 'contentVersionId',
    'profileStatus', v_profile.status,
    'publicStatus', v_profile.public_status,
    'verificationStatus', coalesce(v_verification_status, 'none'),
    'publishedAt', v_content ->> 'publishedAt',
    'fields', jsonb_strip_nulls(
      jsonb_build_object(
        'publicName', v_profile.public_name,
        'headline', v_profile.headline,
        'bio', v_profile.bio,
        'photoUrl', v_profile.photo_url,
        'city', v_profile.city,
        'state', v_profile.state,
        'country', v_profile.country
      ) || coalesce(v_content -> 'fields', '{}'::jsonb)
    ),
    'privateIdentity', v_private_identity,
    'services', v_services
  );
end;
$$;

revoke all on function public.admin_get_therapist_profile_review_v1(uuid)
  from public, anon;
grant execute on function public.admin_get_therapist_profile_review_v1(uuid)
  to authenticated, service_role;

comment on function public.admin_get_therapist_profile_review_v1(uuid) is
  'Admin-only sanitized preview of the latest therapist profile submission, including editorial content, services and private identity/contact needed for validation.';
