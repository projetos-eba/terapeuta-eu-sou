alter table public.therapist_profiles
  add column if not exists public_status text not null default 'draft',
  add column if not exists profile_version bigint not null default 1,
  add column if not exists last_published_at timestamptz,
  add column if not exists unpublished_at timestamptz;

alter table public.therapist_profiles
  drop constraint if exists therapist_profiles_public_status_check;

alter table public.therapist_profiles
  add constraint therapist_profiles_public_status_check
  check (public_status in ('draft', 'published', 'unpublished', 'suspended', 'archived'));

alter table public.therapist_profile_content_versions
  add column if not exists profile_payload jsonb not null default '{}'::jsonb,
  add column if not exists base_profile_version bigint;

update public.therapist_profiles
set
  public_status = case
    when status = 'suspended' then 'suspended'
    when is_public then 'published'
    else 'draft'
  end,
  last_published_at = case when is_public then coalesce(last_published_at, updated_at) else last_published_at end
where public_status = 'draft'
  or (is_public and public_status <> 'published')
  or (status = 'suspended' and public_status <> 'suspended');

create unique index if not exists therapist_profile_one_draft_content_idx
  on public.therapist_profile_content_versions (therapist_profile_id)
  where status = 'draft';

create index if not exists therapist_profiles_public_status_idx
  on public.therapist_profiles (public_status, status, is_public);

create table if not exists public.therapist_profile_mutation_requests (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  request_id uuid not null,
  action text not null,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint therapist_profile_mutation_requests_action check (
    action in ('save_draft', 'discard_draft', 'publish', 'unpublish')
  ),
  unique (therapist_profile_id, request_id, action)
);

create table if not exists public.therapist_profile_events (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  request_id uuid,
  previous_public_status text,
  next_public_status text,
  previous_version bigint,
  next_version bigint,
  reason text,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint therapist_profile_events_type check (
    event_type in (
      'profile_draft_saved',
      'profile_draft_discarded',
      'profile_published',
      'profile_unpublished'
    )
  )
);

create table if not exists public.therapist_private_documents (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_bucket text not null default 'therapist-private-documents',
  storage_object_path text not null,
  document_kind text not null default 'administrative',
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  status text not null default 'uploaded',
  validation_state text not null default 'not_scanned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_private_documents_bucket check (storage_bucket = 'therapist-private-documents'),
  constraint therapist_private_documents_status check (status in ('uploaded', 'accepted', 'rejected', 'archived')),
  constraint therapist_private_documents_validation check (validation_state in ('not_scanned', 'pending', 'passed', 'failed')),
  constraint therapist_private_documents_size check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  unique (storage_bucket, storage_object_path)
);

create trigger set_therapist_private_documents_updated_at
before update on public.therapist_private_documents
for each row execute function public.set_updated_at();

alter table public.therapist_profile_mutation_requests enable row level security;
alter table public.therapist_profile_events enable row level security;
alter table public.therapist_private_documents enable row level security;

drop policy if exists "Therapists can read their own profile content versions"
  on public.therapist_profile_content_versions;
create policy "Therapists can read their own profile content versions"
on public.therapist_profile_content_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = therapist_profile_content_versions.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can read their own guide items"
  on public.therapist_profile_guide_items;
create policy "Therapists can read their own guide items"
on public.therapist_profile_guide_items
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profile_content_versions
    join public.therapist_profiles
      on therapist_profiles.id = therapist_profile_content_versions.therapist_profile_id
    where therapist_profile_content_versions.id = therapist_profile_guide_items.content_version_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can read their own reflections"
  on public.therapist_profile_reflections;
create policy "Therapists can read their own reflections"
on public.therapist_profile_reflections
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profile_content_versions
    join public.therapist_profiles
      on therapist_profiles.id = therapist_profile_content_versions.therapist_profile_id
    where therapist_profile_content_versions.id = therapist_profile_reflections.content_version_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can read their own private documents"
  on public.therapist_private_documents;
create policy "Therapists can read their own private documents"
on public.therapist_private_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = therapist_private_documents.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'therapist-public-media',
    'therapist-public-media',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
  ),
  (
    'therapist-private-documents',
    'therapist-private-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public therapist media is readable"
  on storage.objects;
create policy "Public therapist media is readable"
on storage.objects
for select
using (bucket_id = 'therapist-public-media');

drop policy if exists "Therapists manage own public media folder"
  on storage.objects;
create policy "Therapists manage own public media folder"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'therapist-public-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'therapist-public-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Therapists manage own private document folder"
  on storage.objects;
create policy "Therapists manage own private document folder"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'therapist-private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'therapist-private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

revoke insert, update, delete on public.therapist_profiles from anon, authenticated;
revoke insert, update, delete on public.therapist_profile_content_versions from anon, authenticated;
revoke insert, update, delete on public.therapist_profile_guide_items from anon, authenticated;
revoke insert, update, delete on public.therapist_profile_reflections from anon, authenticated;
revoke all on public.therapist_profile_mutation_requests from anon, authenticated;
revoke all on public.therapist_profile_events from anon, authenticated;
revoke insert, update, delete on public.therapist_private_documents from anon, authenticated;
grant select on public.therapist_private_documents to authenticated;
grant all on public.therapist_profile_mutation_requests to service_role;
grant all on public.therapist_profile_events to service_role;
grant all on public.therapist_private_documents to service_role;

create or replace function public.get_therapist_profile_actor_m1(
  p_actor_user_id uuid
)
returns public.therapist_profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  select *
    into v_therapist
  from public.therapist_profiles
  where user_id = p_actor_user_id;

  if v_therapist.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'PROFILE_LOCKED' using errcode = 'P0001';
  end if;

  return v_therapist;
end;
$$;

create or replace function public.therapist_profile_validate_payload_m1(
  p_payload jsonb,
  p_plan public.therapist_plan
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_public_name text := btrim(coalesce(p_payload ->> 'publicName', ''));
  v_headline text := nullif(btrim(coalesce(p_payload ->> 'headline', '')), '');
  v_bio text := nullif(btrim(coalesce(p_payload ->> 'bio', '')), '');
  v_photo_url text := nullif(btrim(coalesce(p_payload ->> 'photoUrl', '')), '');
  v_city text := nullif(btrim(coalesce(p_payload ->> 'city', '')), '');
  v_state text := nullif(btrim(coalesce(p_payload ->> 'state', '')), '');
  v_short_intro text := nullif(btrim(coalesce(p_payload ->> 'shortIntro', '')), '');
  v_essence_body text := nullif(btrim(coalesce(p_payload ->> 'essenceBody', '')), '');
  v_invitation_body text := nullif(btrim(coalesce(p_payload ->> 'invitationBody', '')), '');
  v_video_url text := nullif(btrim(coalesce(p_payload ->> 'videoUrl', '')), '');
  v_video_provider text := nullif(btrim(coalesce(p_payload ->> 'videoProvider', '')), '');
  v_video_thumbnail_url text := nullif(btrim(coalesce(p_payload ->> 'videoThumbnailUrl', '')), '');
  v_video_title text := nullif(btrim(coalesce(p_payload ->> 'videoTitle', '')), '');
  v_experience_years integer;
  v_guide_items jsonb := coalesce(p_payload -> 'guideItems', '[]'::jsonb);
  v_reflections jsonb := coalesce(p_payload -> 'reflections', '[]'::jsonb);
begin
  if v_public_name = '' or length(v_public_name) > 120 then
    raise exception 'VALIDATION_ERROR: publicName' using errcode = 'P0001';
  end if;

  if v_headline is not null and length(v_headline) > 180 then
    raise exception 'VALIDATION_ERROR: headline' using errcode = 'P0001';
  end if;

  if v_bio is not null and length(v_bio) > 1600 then
    raise exception 'VALIDATION_ERROR: bio' using errcode = 'P0001';
  end if;

  if v_short_intro is not null and length(v_short_intro) > 280 then
    raise exception 'VALIDATION_ERROR: shortIntro' using errcode = 'P0001';
  end if;

  if v_essence_body is not null and length(v_essence_body) > 1600 then
    raise exception 'VALIDATION_ERROR: essenceBody' using errcode = 'P0001';
  end if;

  if v_invitation_body is not null and length(v_invitation_body) > 600 then
    raise exception 'VALIDATION_ERROR: invitationBody' using errcode = 'P0001';
  end if;

  if v_video_url is not null then
    if p_plan = 'free' then
      raise exception 'CAPABILITY_NOT_ALLOWED: video' using errcode = 'P0001';
    end if;

    if v_video_url !~* '^https://[^[:space:]]+$' then
      raise exception 'VALIDATION_ERROR: videoUrl' using errcode = 'P0001';
    end if;
  end if;

  if v_photo_url is not null and v_photo_url !~* '^(https://|/)[^[:space:]]+$' then
    raise exception 'VALIDATION_ERROR: photoUrl' using errcode = 'P0001';
  end if;

  if v_video_provider is not null and v_video_provider not in ('youtube', 'vimeo', 'upload', 'external') then
    raise exception 'VALIDATION_ERROR: videoProvider' using errcode = 'P0001';
  end if;

  if v_video_thumbnail_url is not null and v_video_thumbnail_url !~* '^(https://|/)[^[:space:]]+$' then
    raise exception 'VALIDATION_ERROR: videoThumbnailUrl' using errcode = 'P0001';
  end if;

  if p_payload ? 'experienceYears' and p_payload ->> 'experienceYears' <> '' then
    v_experience_years := (p_payload ->> 'experienceYears')::integer;
    if v_experience_years < 0 or v_experience_years > 80 then
      raise exception 'VALIDATION_ERROR: experienceYears' using errcode = 'P0001';
    end if;
  end if;

  if jsonb_typeof(v_guide_items) <> 'array' or jsonb_array_length(v_guide_items) > 6 then
    raise exception 'VALIDATION_ERROR: guideItems' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_reflections) <> 'array' or jsonb_array_length(v_reflections) > 6 then
    raise exception 'VALIDATION_ERROR: reflections' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'publicName', v_public_name,
    'headline', v_headline,
    'bio', v_bio,
    'photoUrl', v_photo_url,
    'city', v_city,
    'state', v_state,
    'shortIntro', v_short_intro,
    'essenceBody', v_essence_body,
    'invitationBody', v_invitation_body,
    'videoUrl', v_video_url,
    'videoProvider', coalesce(v_video_provider, 'external'),
    'videoThumbnailUrl', v_video_thumbnail_url,
    'videoTitle', v_video_title,
    'experienceYears', v_experience_years,
    'guideItems', v_guide_items,
    'reflections', v_reflections
  );
end;
$$;

create or replace function public.therapist_profile_content_json_m1(
  p_content_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contentVersionId', content.id,
    'status', content.status,
    'baseProfileVersion', content.base_profile_version,
    'updatedAt', content.updated_at,
    'publishedAt', content.published_at,
    'fields', jsonb_strip_nulls(
      content.profile_payload ||
      jsonb_build_object(
        'shortIntro', content.short_intro,
        'essenceBody', content.essence_body,
        'invitationBody', content.invitation_body,
        'videoUrl', content.video_url,
        'videoProvider', content.video_provider,
        'videoThumbnailUrl', content.video_thumbnail_url,
        'videoTitle', content.video_title,
        'experienceYears', content.experience_years,
        'guideItems', coalesce(guide_items.items, '[]'::jsonb),
        'reflections', coalesce(reflections.items, '[]'::jsonb)
      )
    )
  )
  from public.therapist_profile_content_versions as content
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'icon', item.icon,
        'label', item.label
      )
      order by item.sort_order
    ) as items
    from public.therapist_profile_guide_items as item
    where item.content_version_id = content.id
      and item.is_active
  ) as guide_items on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'title', reflection.title,
        'excerpt', reflection.excerpt,
        'imageUrl', reflection.image_url,
        'href', reflection.href,
        'minutesToRead', reflection.minutes_to_read
      )
      order by reflection.sort_order
    ) as items
    from public.therapist_profile_reflections as reflection
    where reflection.content_version_id = content.id
      and reflection.is_public
  ) as reflections on true
  where content.id = p_content_version_id
$$;

create or replace function public.therapist_profile_capabilities_json_m1(
  p_plan public.therapist_plan
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'canPublishProfile', true,
    'canUploadVideo', p_plan in ('premium', 'premium_plus'),
    'canUseFeaturedMedia', p_plan in ('premium', 'premium_plus'),
    'canUseAdvancedSections', p_plan = 'premium_plus',
    'canPublishAdditionalServices', p_plan in ('premium', 'premium_plus')
  )
$$;

create or replace function public.therapist_profile_derived_json_m1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'averageRating', reviews.average_rating,
    'reviewCount', coalesce(reviews.review_count, 0),
    'completedSessions', coalesce(sessions.completed_sessions, 0),
    'startingPriceCents', services.starting_price_cents,
    'activeServiceCount', coalesce(services.active_service_count, 0),
    'availabilityRuleCount', coalesce(availability.rule_count, 0),
    'hasAvailability', coalesce(availability.rule_count, 0) > 0,
    'canReceiveBookings',
      profile.status = 'approved'
      and profile.is_public
      and profile.is_accepting_bookings
      and coalesce(services.active_service_count, 0) > 0
      and coalesce(availability.rule_count, 0) > 0,
    'verificationStatus', coalesce(verification.status::text, 'draft'),
    'plan', profile.plan,
    'accountStatus', profile.status,
    'publicStatus', profile.public_status
  )
  from public.therapist_profiles as profile
  left join lateral (
    select
      round(avg(reviews.rating)::numeric, 1) as average_rating,
      count(*)::integer as review_count
    from public.reviews
    join public.bookings
      on bookings.id = reviews.booking_id
    where reviews.therapist_profile_id = profile.id
      and reviews.status = 'published'
      and bookings.status = 'completed'
      and bookings.payment_status = 'paid'
  ) as reviews on true
  left join lateral (
    select count(*)::integer as completed_sessions
    from public.bookings
    where bookings.therapist_profile_id = profile.id
      and bookings.status = 'completed'
      and bookings.payment_status = 'paid'
  ) as sessions on true
  left join lateral (
    select
      min(price_cents) filter (where status = 'active' and is_bookable and online_only)::integer as starting_price_cents,
      count(*) filter (where status = 'active' and is_bookable and online_only)::integer as active_service_count
    from public.therapist_services
    where therapist_services.therapist_profile_id = profile.id
  ) as services on true
  left join lateral (
    select count(*)::integer as rule_count
    from public.availability_rules
    where availability_rules.therapist_profile_id = profile.id
      and availability_rules.is_active
  ) as availability on true
  left join lateral (
    select status
    from public.therapist_verifications
    where therapist_verifications.therapist_profile_id = profile.id
    order by submitted_at desc
    limit 1
  ) as verification on true
  where profile.id = p_therapist_profile_id
$$;

create or replace function public.therapist_profile_completeness_json_m1(
  p_therapist_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_content jsonb;
  v_score integer := 0;
  v_total integer := 6;
  v_items jsonb := '[]'::jsonb;
  v_has_services boolean;
  v_has_availability boolean;
begin
  select *
    into v_profile
  from public.therapist_profiles
  where id = p_therapist_profile_id;

  select public.therapist_profile_content_json_m1(content.id) -> 'fields'
    into v_content
  from public.therapist_profile_content_versions as content
  where content.therapist_profile_id = p_therapist_profile_id
    and content.status = 'published'
  order by content.published_at desc nulls last, content.created_at desc
  limit 1;

  select exists (
    select 1 from public.therapist_services
    where therapist_profile_id = p_therapist_profile_id
      and status = 'active'
      and is_bookable
      and online_only
  ) into v_has_services;

  select exists (
    select 1 from public.availability_rules
    where therapist_profile_id = p_therapist_profile_id
      and is_active
  ) into v_has_availability;

  if v_profile.photo_url is not null then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'photo', 'label', 'Foto de perfil', 'complete', v_profile.photo_url is not null));

  if coalesce(v_profile.headline, v_content ->> 'shortIntro', '') <> '' then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'short_intro', 'label', 'Texto curto', 'complete', coalesce(v_profile.headline, v_content ->> 'shortIntro', '') <> ''));

  if coalesce(v_profile.bio, v_content ->> 'essenceBody', '') <> '' then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'bio', 'label', 'Minha essência', 'complete', coalesce(v_profile.bio, v_content ->> 'essenceBody', '') <> ''));

  if jsonb_array_length(coalesce(v_content -> 'guideItems', '[]'::jsonb)) > 0 then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'guide_items', 'label', 'Especialidades', 'complete', jsonb_array_length(coalesce(v_content -> 'guideItems', '[]'::jsonb)) > 0));

  if v_has_services then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'services', 'label', 'Preços dos serviços', 'complete', v_has_services));

  if v_has_availability then v_score := v_score + 1; end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'availability', 'label', 'Horários disponíveis', 'complete', v_has_availability));

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percent', round((v_score::numeric / v_total::numeric) * 100)::integer,
    'items', v_items
  );
end;
$$;

create or replace function public.therapist_profile_published_fields_m1(
  p_profile public.therapist_profiles
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_content jsonb;
begin
  select public.therapist_profile_content_json_m1(content.id)
    into v_content
  from public.therapist_profile_content_versions as content
  where content.therapist_profile_id = p_profile.id
    and content.status = 'published'
  order by content.published_at desc nulls last, content.created_at desc
  limit 1;

  return jsonb_build_object(
    'fields', jsonb_strip_nulls(
      jsonb_build_object(
        'publicName', p_profile.public_name,
        'headline', p_profile.headline,
        'bio', p_profile.bio,
        'photoUrl', p_profile.photo_url,
        'city', p_profile.city,
        'state', p_profile.state
      ) || coalesce(v_content -> 'fields', '{}'::jsonb)
    ),
    'contentVersionId', v_content ->> 'contentVersionId',
    'publishedAt', v_content ->> 'publishedAt'
  );
end;
$$;

create or replace function public.get_private_therapist_profile_editor_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_draft jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);

  select public.therapist_profile_content_json_m1(content.id)
    into v_draft
  from public.therapist_profile_content_versions as content
  where content.therapist_profile_id = v_profile.id
    and content.status = 'draft'
  order by content.updated_at desc
  limit 1;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_profile.id,
    'version', v_profile.profile_version,
    'updatedAt', v_profile.updated_at,
    'publicProfileHref', '/terapeutas/' || v_profile.slug,
    'propagationNotice', 'As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.',
    'published', public.therapist_profile_published_fields_m1(v_profile),
    'draft', v_draft,
    'derived', public.therapist_profile_derived_json_m1(v_profile.id),
    'completeness', public.therapist_profile_completeness_json_m1(v_profile.id),
    'capabilities', public.therapist_profile_capabilities_json_m1(v_profile.plan)
  );
end;
$$;

create or replace function public.therapist_profile_request_replay_m1(
  p_therapist_profile_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_existing public.therapist_profile_mutation_requests%rowtype;
begin
  select *
    into v_existing
  from public.therapist_profile_mutation_requests
  where therapist_profile_id = p_therapist_profile_id
    and request_id = p_request_id
    and action = p_action;

  if v_existing.id is null then
    return null;
  end if;

  if v_existing.payload_hash <> p_payload_hash then
    raise exception 'PROFILE_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  return jsonb_set(v_existing.response, '{idempotentReplay}', 'true'::jsonb, true);
end;
$$;

create or replace function public.therapist_profile_store_request_m1(
  p_therapist_profile_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_response jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.therapist_profile_mutation_requests (
    therapist_profile_id,
    request_id,
    action,
    payload_hash,
    response
  )
  values (
    p_therapist_profile_id,
    p_request_id,
    p_action,
    p_payload_hash,
    p_response
  )
  on conflict (therapist_profile_id, request_id, action) do nothing;

  return p_response;
end;
$$;

create or replace function public.therapist_profile_replace_children_m1(
  p_content_version_id uuid,
  p_guide_items jsonb,
  p_reflections jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer := 0;
begin
  delete from public.therapist_profile_guide_items
  where content_version_id = p_content_version_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_guide_items, '[]'::jsonb))
  loop
    v_index := v_index + 1;
    insert into public.therapist_profile_guide_items (
      content_version_id,
      icon,
      label,
      sort_order,
      is_active
    )
    values (
      p_content_version_id,
      coalesce(nullif(btrim(v_item ->> 'icon'), ''), 'sparkles'),
      btrim(coalesce(v_item ->> 'label', '')),
      v_index,
      btrim(coalesce(v_item ->> 'label', '')) <> ''
    );
  end loop;

  delete from public.therapist_profile_reflections
  where content_version_id = p_content_version_id;

  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_reflections, '[]'::jsonb))
  loop
    v_index := v_index + 1;
    if btrim(coalesce(v_item ->> 'title', '')) <> '' then
      insert into public.therapist_profile_reflections (
        content_version_id,
        title,
        excerpt,
        image_url,
        href,
        minutes_to_read,
        sort_order,
        is_public
      )
      values (
        p_content_version_id,
        btrim(v_item ->> 'title'),
        nullif(btrim(coalesce(v_item ->> 'excerpt', '')), ''),
        nullif(btrim(coalesce(v_item ->> 'imageUrl', '')), ''),
        nullif(btrim(coalesce(v_item ->> 'href', '')), ''),
        coalesce(nullif(v_item ->> 'minutesToRead', '')::integer, 3),
        v_index,
        true
      );
    end if;
  end loop;
end;
$$;

create or replace function public.save_therapist_profile_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_payload jsonb;
  v_payload_hash text := encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
  v_replay jsonb;
  v_content_id uuid;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'save_draft', v_payload_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  v_payload := public.therapist_profile_validate_payload_m1(p_payload, v_profile.plan);

  insert into public.therapist_profile_content_versions (
    therapist_profile_id,
    status,
    short_intro,
    essence_body,
    invitation_body,
    video_url,
    video_provider,
    video_thumbnail_url,
    video_title,
    experience_years,
    profile_payload,
    base_profile_version
  )
  values (
    v_profile.id,
    'draft',
    v_payload ->> 'shortIntro',
    v_payload ->> 'essenceBody',
    v_payload ->> 'invitationBody',
    v_payload ->> 'videoUrl',
    v_payload ->> 'videoProvider',
    v_payload ->> 'videoThumbnailUrl',
    v_payload ->> 'videoTitle',
    nullif(v_payload ->> 'experienceYears', '')::integer,
    jsonb_strip_nulls(jsonb_build_object(
      'publicName', v_payload ->> 'publicName',
      'headline', v_payload ->> 'headline',
      'bio', v_payload ->> 'bio',
      'photoUrl', v_payload ->> 'photoUrl',
      'city', v_payload ->> 'city',
      'state', v_payload ->> 'state'
    )),
    v_profile.profile_version
  )
  on conflict (therapist_profile_id) where status = 'draft'
  do update set
    short_intro = excluded.short_intro,
    essence_body = excluded.essence_body,
    invitation_body = excluded.invitation_body,
    video_url = excluded.video_url,
    video_provider = excluded.video_provider,
    video_thumbnail_url = excluded.video_thumbnail_url,
    video_title = excluded.video_title,
    experience_years = excluded.experience_years,
    profile_payload = excluded.profile_payload,
    base_profile_version = excluded.base_profile_version,
    updated_at = now()
  returning id into v_content_id;

  perform public.therapist_profile_replace_children_m1(
    v_content_id,
    v_payload -> 'guideItems',
    v_payload -> 'reflections'
  );

  insert into public.therapist_profile_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_public_status,
    next_public_status,
    previous_version,
    next_version
  )
  values (
    v_profile.id,
    p_actor_user_id,
    'profile_draft_saved',
    p_request_id,
    v_profile.public_status,
    v_profile.public_status,
    v_profile.profile_version,
    v_profile.profile_version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );

  return public.therapist_profile_store_request_m1(
    v_profile.id,
    p_request_id,
    'save_draft',
    v_payload_hash,
    v_response
  );
end;
$$;

create or replace function public.discard_therapist_profile_draft_v1(
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
  v_payload_hash text := encode(extensions.digest(p_expected_version::text, 'sha256'), 'hex');
  v_replay jsonb;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'discard_draft', v_payload_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  delete from public.therapist_profile_content_versions
  where therapist_profile_id = v_profile.id
    and status = 'draft';

  insert into public.therapist_profile_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_public_status,
    next_public_status,
    previous_version,
    next_version
  )
  values (
    v_profile.id,
    p_actor_user_id,
    'profile_draft_discarded',
    p_request_id,
    v_profile.public_status,
    v_profile.public_status,
    v_profile.profile_version,
    v_profile.profile_version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );

  return public.therapist_profile_store_request_m1(
    v_profile.id,
    p_request_id,
    'discard_draft',
    v_payload_hash,
    v_response
  );
end;
$$;

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
  v_draft public.therapist_profile_content_versions%rowtype;
  v_fields jsonb;
  v_previous_status text;
  v_payload_hash text := encode(extensions.digest(p_expected_version::text, 'sha256'), 'hex');
  v_replay jsonb;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'publish', v_payload_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  select *
    into v_draft
  from public.therapist_profile_content_versions
  where therapist_profile_id = v_profile.id
    and status = 'draft'
  limit 1;

  if v_draft.id is null then
    raise exception 'VALIDATION_ERROR: draft' using errcode = 'P0001';
  end if;

  v_fields := public.therapist_profile_content_json_m1(v_draft.id) -> 'fields';
  if coalesce(v_fields ->> 'publicName', '') = ''
    or coalesce(v_fields ->> 'shortIntro', v_fields ->> 'headline', '') = ''
    or coalesce(v_fields ->> 'essenceBody', v_fields ->> 'bio', '') = ''
  then
    raise exception 'VALIDATION_ERROR: completeness' using errcode = 'P0001';
  end if;

  v_previous_status := v_profile.public_status;

  update public.therapist_profile_content_versions
  set
    status = 'published',
    published_at = now(),
    updated_at = now()
  where id = v_draft.id;

  update public.therapist_profiles
  set
    public_name = v_fields ->> 'publicName',
    headline = nullif(v_fields ->> 'headline', ''),
    bio = nullif(v_fields ->> 'bio', ''),
    photo_url = nullif(v_fields ->> 'photoUrl', ''),
    city = nullif(v_fields ->> 'city', ''),
    state = nullif(v_fields ->> 'state', ''),
    is_public = true,
    public_status = 'published',
    last_published_at = now(),
    unpublished_at = null,
    profile_version = profile_version + 1,
    updated_at = now()
  where id = v_profile.id
  returning * into v_profile;

  insert into public.therapist_profile_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_public_status,
    next_public_status,
    previous_version,
    next_version
  )
  values (
    v_profile.id,
    p_actor_user_id,
    'profile_published',
    p_request_id,
    coalesce(v_previous_status, 'draft'),
    'published',
    p_expected_version,
    v_profile.profile_version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );

  return public.therapist_profile_store_request_m1(
    v_profile.id,
    p_request_id,
    'publish',
    v_payload_hash,
    v_response
  );
end;
$$;

create or replace function public.unpublish_therapist_profile_v1(
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
  v_previous_status text;
  v_payload_hash text := encode(extensions.digest(p_expected_version::text, 'sha256'), 'hex');
  v_replay jsonb;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'unpublish', v_payload_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  v_previous_status := v_profile.public_status;

  update public.therapist_profiles
  set
    is_public = false,
    public_status = 'unpublished',
    unpublished_at = now(),
    profile_version = profile_version + 1,
    updated_at = now()
  where id = v_profile.id
  returning * into v_profile;

  insert into public.therapist_profile_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_public_status,
    next_public_status,
    previous_version,
    next_version
  )
  values (
    v_profile.id,
    p_actor_user_id,
    'profile_unpublished',
    p_request_id,
    v_previous_status,
    'unpublished',
    p_expected_version,
    v_profile.profile_version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );

  return public.therapist_profile_store_request_m1(
    v_profile.id,
    p_request_id,
    'unpublish',
    v_payload_hash,
    v_response
  );
end;
$$;

revoke all on function public.get_therapist_profile_actor_m1(uuid) from public;
revoke all on function public.therapist_profile_validate_payload_m1(jsonb, public.therapist_plan) from public;
revoke all on function public.therapist_profile_content_json_m1(uuid) from public;
revoke all on function public.therapist_profile_capabilities_json_m1(public.therapist_plan) from public;
revoke all on function public.therapist_profile_derived_json_m1(uuid) from public;
revoke all on function public.therapist_profile_completeness_json_m1(uuid) from public;
revoke all on function public.therapist_profile_published_fields_m1(public.therapist_profiles) from public;
revoke all on function public.get_private_therapist_profile_editor_v1(uuid) from public;
revoke all on function public.therapist_profile_request_replay_m1(uuid, uuid, text, text) from public;
revoke all on function public.therapist_profile_store_request_m1(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.therapist_profile_replace_children_m1(uuid, jsonb, jsonb) from public;
revoke all on function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb) from public;
revoke all on function public.discard_therapist_profile_draft_v1(uuid, uuid, bigint) from public;
revoke all on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint) from public;
revoke all on function public.unpublish_therapist_profile_v1(uuid, uuid, bigint) from public;

grant execute on function public.get_private_therapist_profile_editor_v1(uuid)
  to service_role;
grant execute on function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb)
  to service_role;
grant execute on function public.discard_therapist_profile_draft_v1(uuid, uuid, bigint)
  to service_role;
grant execute on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint)
  to service_role;
grant execute on function public.unpublish_therapist_profile_v1(uuid, uuid, bigint)
  to service_role;

comment on column public.therapist_profiles.public_status is
  'Public lifecycle of the therapist profile. Administrative account status remains separate in therapist_profiles.status.';
comment on column public.therapist_profiles.profile_version is
  'Optimistic version used by the therapist profile editor. Draft saves do not change public surfaces.';
comment on column public.therapist_profile_content_versions.profile_payload is
  'Draft/published public identity fields that are applied to therapist_profiles only on therapist publication.';
comment on table public.therapist_profile_mutation_requests is
  'Idempotency ledger for therapist profile editor mutations executed by authenticated Edge Functions.';
comment on table public.therapist_profile_events is
  'Sanitized audit trail for therapist profile draft and publication lifecycle changes.';
comment on table public.therapist_private_documents is
  'Private administrative therapist files. They must never be joined into public DTOs or public profile views.';
comment on function public.get_private_therapist_profile_editor_v1(uuid) is
  'Private editor read model for Meu Perfil. Intended for service_role Edge Functions after deriving therapist from auth token.';
