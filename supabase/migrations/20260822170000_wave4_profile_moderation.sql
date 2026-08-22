-- Wave 4: every therapist profile publication is submitted for administrative
-- review before it can become public again.  The existing verification
-- lifecycle remains the authority; this migration closes the gap where an
-- already-approved therapist could publish a changed profile directly.

create or replace function public.queue_therapist_profile_review_v1(
  p_therapist_profile_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_verification public.therapist_verifications%rowtype;
begin
  select * into v_profile
  from public.therapist_profiles
  where id = p_therapist_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_profile.status = 'suspended'::public.therapist_status then
    return;
  end if;

  select * into v_verification
  from public.therapist_verifications
  where therapist_profile_id = v_profile.id
  order by submitted_at desc nulls last, created_at desc, id desc
  limit 1
  for update;

  if v_verification.id is null
    or v_verification.status = 'approved'::public.therapist_status
  then
    insert into public.therapist_verifications (
      therapist_profile_id,
      status,
      submitted_at
    ) values (
      v_profile.id,
      'submitted'::public.therapist_status,
      now()
    );
  else
    update public.therapist_verifications
    set status = 'submitted'::public.therapist_status,
        changes_requested = null,
        rejection_reason = null,
        reviewed_by = null,
        reviewed_at = null,
        submitted_at = now(),
        updated_at = now()
    where id = v_verification.id;
  end if;

  -- A submitted profile must not remain visible or bookable while the new
  -- content is being reviewed.  The content version is retained for the
  -- admin-only review read model and is never exposed by public views.
  update public.therapist_profiles
  set status = 'submitted'::public.therapist_status,
      public_status = 'unpublished',
      is_public = false,
      is_accepting_bookings = false,
      updated_at = now()
  where id = v_profile.id;
end;
$$;

revoke all on function public.queue_therapist_profile_review_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.queue_therapist_profile_review_v1(uuid)
  to service_role;

create or replace function public.publish_therapist_profile_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_theme text;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  select public_profile_theme into v_theme
  from public.therapist_profile_content_versions
  where therapist_profile_id = v_profile.id and status = 'draft'
  order by updated_at desc limit 1;

  v_response := public.publish_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version
  );

  if coalesce(v_response ->> 'idempotentReplay', 'false') <> 'true' then
    perform public.queue_therapist_profile_review_v1(v_profile.id);
  end if;

  if v_theme is null then
    select public_profile_theme into v_theme
    from public.therapist_profile_content_versions
    where therapist_profile_id = v_profile.id and status = 'published'
    order by published_at desc nulls last, created_at desc limit 1;
  end if;

  update public.therapist_profiles
  set public_profile_theme = coalesce(v_theme, 'serene')
  where id = v_profile.id;

  v_response := jsonb_set(
    v_response,
    '{editor}',
    public.get_private_therapist_profile_editor_v1(p_actor_user_id),
    true
  );
  update public.therapist_profile_mutation_requests
  set response = v_response
  where therapist_profile_id = v_profile.id
    and request_id = p_request_id
    and action = 'publish';
  return v_response;
end;
$$;

revoke all on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint)
  to service_role;

-- Admin-only, sanitized review projection. It reads the latest submitted
-- content even while public views correctly hide the profile and includes
-- only the private identity fields needed for administrative validation. No
-- private documents, account credentials or internal storage paths are included.
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

comment on function public.queue_therapist_profile_review_v1(uuid) is
  'Queues every newly published therapist profile version for administrative review and removes public visibility until approval.';
comment on function public.admin_get_therapist_profile_review_v1(uuid) is
  'Admin-only sanitized preview of the latest therapist profile submission, including public content, video link, services and private identity for validation.';

-- Private account identity required for administrative verification.  This is
-- intentionally separate from profiles, public profile content and private
-- document storage.  Values are normalized server-side; masks belong only to
-- the therapist settings form.
create table if not exists public.therapist_private_identity (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null unique references public.therapist_profiles (id) on delete cascade,
  document_type text not null,
  document_number text not null,
  postal_code text not null,
  street text not null,
  street_number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  country text not null default 'BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_private_identity_document_type_check
    check (document_type in ('cpf', 'rg', 'passport')),
  constraint therapist_private_identity_document_number_check
    check (length(document_number) between 6 and 20),
  constraint therapist_private_identity_postal_code_check
    check (postal_code ~ '^[0-9]{8}$'),
  constraint therapist_private_identity_state_check
    check (length(state) = 2)
);

create index if not exists therapist_private_identity_profile_idx
  on public.therapist_private_identity (therapist_profile_id);

drop trigger if exists set_therapist_private_identity_updated_at
  on public.therapist_private_identity;
create trigger set_therapist_private_identity_updated_at
before update on public.therapist_private_identity
for each row execute function public.set_updated_at();

alter table public.therapist_private_identity enable row level security;
revoke all on public.therapist_private_identity from anon, authenticated;
grant select, insert, update on public.therapist_private_identity to authenticated;

drop policy if exists "Therapists can read own private identity"
  on public.therapist_private_identity;
create policy "Therapists can read own private identity"
on public.therapist_private_identity
for select to authenticated
using (
  exists (
    select 1 from public.therapist_profiles
    where therapist_profiles.id = therapist_private_identity.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can insert own private identity"
  on public.therapist_private_identity;
create policy "Therapists can insert own private identity"
on public.therapist_private_identity
for insert to authenticated
with check (
  exists (
    select 1 from public.therapist_profiles
    where therapist_profiles.id = therapist_private_identity.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can update own private identity"
  on public.therapist_private_identity;
create policy "Therapists can update own private identity"
on public.therapist_private_identity
for update to authenticated
using (
  exists (
    select 1 from public.therapist_profiles
    where therapist_profiles.id = therapist_private_identity.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.therapist_profiles
    where therapist_profiles.id = therapist_private_identity.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

create or replace function public.get_therapist_private_identity_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_build_object(
      'documentType', identity.document_type,
      'documentNumber', identity.document_number,
      'postalCode', identity.postal_code,
      'street', identity.street,
      'streetNumber', identity.street_number,
      'complement', identity.complement,
      'neighborhood', identity.neighborhood,
      'city', identity.city,
      'state', identity.state,
      'country', identity.country
    ),
    '{}'::jsonb
  )
  from public.therapist_private_identity identity
  join public.therapist_profiles profile
    on profile.id = identity.therapist_profile_id
  where profile.user_id = auth.uid()
  limit 1
$$;

create or replace function public.save_therapist_private_identity_v1(
  p_document_type text,
  p_document_number text,
  p_postal_code text,
  p_street text,
  p_street_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_country text default 'BR'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_document_type text := lower(btrim(coalesce(p_document_type, '')));
  v_document_number text := upper(regexp_replace(btrim(coalesce(p_document_number, '')), '[^0-9A-Za-z]', '', 'g'));
  v_postal_code text := regexp_replace(btrim(coalesce(p_postal_code, '')), '[^0-9]', '', 'g');
  v_country text := upper(btrim(coalesce(p_country, 'BR')));
  v_cpf_check_1 integer;
  v_cpf_check_2 integer;
begin
  select id into v_profile_id
  from public.therapist_profiles
  where user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'therapist profile required' using errcode = '42501';
  end if;
  if v_document_type not in ('cpf', 'rg', 'passport') then
    raise exception 'invalid document type' using errcode = '22023';
  end if;
  if length(v_document_number) < 6 or length(v_document_number) > 20 then
    raise exception 'invalid document number' using errcode = '22023';
  end if;
  if v_document_type = 'cpf' then
    if v_document_number !~ '^[0-9]{11}$'
      or v_document_number ~ '^([0-9])\1{10}$'
    then
      raise exception 'invalid cpf' using errcode = '22023';
    end if;
    select case
      when mod(sum(substr(v_document_number, position, 1)::integer * (11 - position)), 11) < 2 then 0
      else 11 - mod(sum(substr(v_document_number, position, 1)::integer * (11 - position)), 11)
    end
    into v_cpf_check_1
    from generate_series(1, 9) as series(position);
    select case
      when mod(sum(substr(v_document_number, position, 1)::integer * (12 - position)), 11) < 2 then 0
      else 11 - mod(sum(substr(v_document_number, position, 1)::integer * (12 - position)), 11)
    end
    into v_cpf_check_2
    from generate_series(1, 10) as series(position);
    if v_cpf_check_1 <> substr(v_document_number, 10, 1)::integer
      or v_cpf_check_2 <> substr(v_document_number, 11, 1)::integer
    then
      raise exception 'invalid cpf' using errcode = '22023';
    end if;
  end if;
  if v_document_type = 'passport' and v_document_number !~ '^[A-Z0-9]{6,9}$' then
    raise exception 'invalid passport' using errcode = '22023';
  end if;
  if v_document_type = 'rg' and v_document_number !~ '^[0-9A-Z]{7,14}$' then
    raise exception 'invalid rg' using errcode = '22023';
  end if;
  if v_postal_code !~ '^[0-9]{8}$' then
    raise exception 'invalid postal code' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_street, ''))) not between 2 and 160
    or length(btrim(coalesce(p_street_number, ''))) not between 1 and 20
    or length(btrim(coalesce(p_neighborhood, ''))) not between 2 and 100
    or length(btrim(coalesce(p_city, ''))) not between 2 and 100
    or length(btrim(coalesce(p_state, ''))) not between 2 and 2
    or v_country <> 'BR'
  then
    raise exception 'invalid address' using errcode = '22023';
  end if;

  insert into public.therapist_private_identity (
    therapist_profile_id, document_type, document_number, postal_code,
    street, street_number, complement, neighborhood, city, state, country
  ) values (
    v_profile_id, v_document_type, v_document_number, v_postal_code,
    btrim(p_street), btrim(p_street_number), nullif(btrim(coalesce(p_complement, '')), ''),
    btrim(p_neighborhood), btrim(p_city), upper(btrim(p_state)), v_country
  )
  on conflict (therapist_profile_id) do update set
    document_type = excluded.document_type,
    document_number = excluded.document_number,
    postal_code = excluded.postal_code,
    street = excluded.street,
    street_number = excluded.street_number,
    complement = excluded.complement,
    neighborhood = excluded.neighborhood,
    city = excluded.city,
    state = excluded.state,
    country = excluded.country,
    updated_at = now();

  return public.get_therapist_private_identity_v1();
end;
$$;

revoke all on function public.get_therapist_private_identity_v1() from public, anon;
grant execute on function public.get_therapist_private_identity_v1() to authenticated, service_role;
revoke all on function public.save_therapist_private_identity_v1(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_therapist_private_identity_v1(text, text, text, text, text, text, text, text, text, text) to authenticated, service_role;

comment on table public.therapist_private_identity is
  'Private therapist identity and address data used for administrative verification. Never included in public profile projections.';
