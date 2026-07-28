create extension if not exists pgcrypto;

alter table public.therapies
  add column if not exists deprecated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists replacement_therapy_id uuid references public.therapies (id) on delete set null;

create table if not exists public.therapy_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  old_slug text not null,
  current_slug text not null,
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint therapy_slug_redirects_no_chain check (old_slug <> current_slug),
  constraint therapy_slug_redirects_unique unique (old_slug)
);

create table if not exists public.therapy_catalog_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles (id) on delete cascade,
  requester_therapist_profile_id uuid references public.therapist_profiles (id) on delete set null,
  informed_name text not null,
  description text,
  suggested_category_id uuid references public.therapy_categories (id) on delete set null,
  justification text,
  status text not null default 'submitted',
  related_therapy_id uuid references public.therapies (id) on delete set null,
  decision text,
  decided_by_profile_id uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapy_catalog_requests_status_check check (
    status in (
      'submitted',
      'under_review',
      'needs_information',
      'approved',
      'merged',
      'rejected'
    )
  ),
  constraint therapy_catalog_requests_name_length check (
    char_length(trim(informed_name)) between 2 and 120
  )
);

create table if not exists public.therapy_catalog_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_role public.user_role not null default 'admin',
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  previous_state jsonb,
  next_state jsonb,
  reason text,
  correlation_id uuid not null default gen_random_uuid(),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint therapy_catalog_events_entity_check check (
    entity_type in ('therapy', 'therapy_catalog_request')
  )
);

create index if not exists therapy_slug_redirects_old_slug_idx
  on public.therapy_slug_redirects (old_slug);
create index if not exists therapy_catalog_requests_status_idx
  on public.therapy_catalog_requests (status, created_at desc);
create index if not exists therapy_catalog_requests_requester_idx
  on public.therapy_catalog_requests (requester_profile_id, created_at desc);
create index if not exists therapy_catalog_events_entity_idx
  on public.therapy_catalog_events (entity_type, entity_id, created_at desc);
create index if not exists therapies_public_admin_idx
  on public.therapies (category_id, status, is_public_visible, is_available_for_services);
create index if not exists therapies_redirect_slug_idx
  on public.therapies (slug, status);

drop trigger if exists set_therapy_catalog_requests_updated_at
on public.therapy_catalog_requests;
create trigger set_therapy_catalog_requests_updated_at
before update on public.therapy_catalog_requests
for each row execute function public.set_updated_at();

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_current_admin() from public;
grant execute on function public.is_current_admin() to authenticated, service_role;

alter table public.therapy_slug_redirects enable row level security;
alter table public.therapy_catalog_requests enable row level security;
alter table public.therapy_catalog_events enable row level security;
alter table public.therapy_public_content enable row level security;
alter table public.therapy_highlights enable row level security;
alter table public.therapy_benefits enable row level security;
alter table public.therapy_faqs enable row level security;
alter table public.matching_therapy_settings enable row level security;

grant select on public.therapy_slug_redirects to anon, authenticated, service_role;
grant select on public.therapy_catalog_requests to authenticated, service_role;
grant select on public.therapy_catalog_events to authenticated, service_role;
grant select on public.therapy_public_content to authenticated, service_role;
grant select on public.therapy_highlights to authenticated, service_role;
grant select on public.therapy_benefits to authenticated, service_role;
grant select on public.therapy_faqs to authenticated, service_role;
grant select on public.matching_therapy_settings to authenticated, service_role;
grant all on public.therapy_slug_redirects to service_role;
grant all on public.therapy_catalog_requests to service_role;
grant all on public.therapy_catalog_events to service_role;

drop policy if exists "Admins can read therapy slug redirects"
on public.therapy_slug_redirects;
create policy "Admins can read therapy slug redirects"
on public.therapy_slug_redirects
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Public can read therapy slug redirects"
on public.therapy_slug_redirects;
create policy "Public can read therapy slug redirects"
on public.therapy_slug_redirects
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can read therapy catalog requests"
on public.therapy_catalog_requests;
create policy "Admins can read therapy catalog requests"
on public.therapy_catalog_requests
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Therapists can read own therapy catalog requests"
on public.therapy_catalog_requests;
create policy "Therapists can read own therapy catalog requests"
on public.therapy_catalog_requests
for select
to authenticated
using (requester_profile_id = auth.uid());

drop policy if exists "Admins can read therapy catalog events"
on public.therapy_catalog_events;
create policy "Admins can read therapy catalog events"
on public.therapy_catalog_events
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read canonical therapies"
on public.therapies;
create policy "Admins can read canonical therapies"
on public.therapies
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read therapy categories"
on public.therapy_categories;
create policy "Admins can read therapy categories"
on public.therapy_categories
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read therapy public content"
on public.therapy_public_content;
create policy "Admins can read therapy public content"
on public.therapy_public_content
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read therapy highlights"
on public.therapy_highlights;
create policy "Admins can read therapy highlights"
on public.therapy_highlights
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read therapy benefits"
on public.therapy_benefits;
create policy "Admins can read therapy benefits"
on public.therapy_benefits
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read therapy faqs"
on public.therapy_faqs;
create policy "Admins can read therapy faqs"
on public.therapy_faqs
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Admins can read matching therapy settings"
on public.matching_therapy_settings;
create policy "Admins can read matching therapy settings"
on public.matching_therapy_settings
for select
to authenticated
using (public.is_current_admin());

create or replace view public.public_therapy_slug_redirects_v as
select
  old_slug,
  current_slug,
  therapy_id,
  created_at
from public.therapy_slug_redirects;

grant select on public.public_therapy_slug_redirects_v
to anon, authenticated, service_role;

create or replace function public.admin_get_actor_profile_v1(
  p_actor_user_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_actor_user_id
    and role = 'admin';

  if v_profile.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_ADMIN_REQUIRED';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_therapy_impact_v1(
  p_actor_user_id uuid,
  p_therapy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_get_actor_profile_v1(p_actor_user_id);

  return (
    select jsonb_build_object(
      'therapyId', therapies.id,
      'slug', therapies.slug,
      'name', therapies.name,
      'status', therapies.status,
      'isPubliclyVisible', therapies.is_public_visible,
      'isAvailableForServices', therapies.is_available_for_services,
      'isVisibleInMatching', coalesce(matching_therapy_settings.is_visible_in_matching, false),
      'serviceCount', coalesce(service_counts.service_count, 0),
      'activeServiceCount', coalesce(service_counts.active_service_count, 0),
      'therapistCount', coalesce(service_counts.therapist_count, 0),
      'futureBookingCount', coalesce(booking_counts.future_booking_count, 0),
      'publicProfileCount', coalesce(profile_counts.public_profile_count, 0)
    )
    from public.therapies
    left join public.matching_therapy_settings
      on matching_therapy_settings.therapy_id = therapies.id
    left join lateral (
      select
        count(*)::integer as service_count,
        count(*) filter (
          where therapist_services.status = 'active'
            and therapist_services.is_bookable = true
        )::integer as active_service_count,
        count(distinct therapist_services.therapist_profile_id)::integer as therapist_count
      from public.therapist_services
      where therapist_services.therapy_id = therapies.id
    ) as service_counts on true
    left join lateral (
      select count(*)::integer as future_booking_count
      from public.bookings
      join public.therapist_services
        on therapist_services.id = bookings.service_id
      where therapist_services.therapy_id = therapies.id
        and bookings.starts_at >= now()
        and bookings.status in ('pending_payment', 'confirmed')
    ) as booking_counts on true
    left join lateral (
      select count(distinct therapist_profiles.id)::integer as public_profile_count
      from public.therapist_profiles
      join public.therapist_services
        on therapist_services.therapist_profile_id = therapist_profiles.id
      where therapist_services.therapy_id = therapies.id
        and therapist_profiles.status = 'approved'
        and therapist_profiles.is_public = true
        and therapist_services.status = 'active'
        and therapist_services.is_bookable = true
    ) as profile_counts on true
    where therapies.id = p_therapy_id
  );
end;
$$;

create or replace function public.admin_list_therapy_catalog_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_get_actor_profile_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'slug', slug,
          'isActive', is_active,
          'sortOrder', sort_order
        )
        order by sort_order asc, name asc
      )
      from public.therapy_categories
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(item order by item->>'name')
      from (
        select jsonb_build_object(
          'id', therapies.id,
          'name', therapies.name,
          'slug', therapies.slug,
          'categoryId', therapies.category_id,
          'categoryName', therapy_categories.name,
          'categorySlug', therapy_categories.slug,
          'categoryIsActive', therapy_categories.is_active,
          'status', therapies.status,
          'isPubliclyVisible', therapies.is_public_visible,
          'isAvailableForServices', therapies.is_available_for_services,
          'isVisibleInMatching', coalesce(matching_therapy_settings.is_visible_in_matching, false),
          'hasPublishedMatchWeights', exists (
            select 1
            from public.matching_weights
            join public.matching_versions
              on matching_versions.id = matching_weights.version_id
            where matching_weights.therapy_id = therapies.id
              and matching_weights.is_active = true
              and matching_versions.status = 'published'
          ),
          'isFeatured', therapies.is_featured,
          'publishedAt', therapies.published_at,
          'deprecatedAt', therapies.deprecated_at,
          'archivedAt', therapies.archived_at,
          'replacementTherapyId', therapies.replacement_therapy_id,
          'shortDescription', therapies.short_description,
          'description', therapies.description,
          'imageUrl', therapies.image_url,
          'aliases', therapies.search_aliases,
          'calendarColorKey', therapies.calendar_color_key,
          'publicContent', jsonb_build_object(
            'subtitle', therapy_public_content.subtitle,
            'introduction', therapy_public_content.introduction,
            'complementaryDescription', therapy_public_content.complementary_description,
            'safetyNote', coalesce(therapy_public_content.safety_note, therapies.safety_note),
            'seoTitle', therapy_public_content.seo_title,
            'seoDescription', therapy_public_content.seo_description,
            'heroImageUrl', therapy_public_content.hero_image_url,
            'approachLabel', therapy_public_content.approach_label,
            'approachIconKey', therapy_public_content.approach_icon_key,
            'visualThemeKey', therapy_public_content.visual_theme_key,
            'heroFocalPoint', therapy_public_content.hero_focal_point,
            'highlights', coalesce(highlights.items, '[]'::jsonb),
            'benefits', coalesce(benefits.items, '[]'::jsonb),
            'faqs', coalesce(faqs.items, '[]'::jsonb)
          ),
          'history', coalesce(events.items, '[]'::jsonb),
          'impact', public.admin_therapy_impact_v1(p_actor_user_id, therapies.id),
          'updatedAt', therapies.updated_at
        ) as item
        from public.therapies
        join public.therapy_categories
          on therapy_categories.id = therapies.category_id
        left join public.matching_therapy_settings
          on matching_therapy_settings.therapy_id = therapies.id
        left join public.therapy_public_content
          on therapy_public_content.therapy_id = therapies.id
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('title', title, 'iconKey', icon_key)
            order by sort_order asc
          ) as items
          from public.therapy_highlights
          where therapy_highlights.therapy_id = therapies.id
        ) as highlights on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('title', title, 'description', description, 'iconKey', icon_key)
            order by sort_order asc
          ) as items
          from public.therapy_benefits
          where therapy_benefits.therapy_id = therapies.id
        ) as benefits on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('question', question, 'answer', answer)
            order by sort_order asc
          ) as items
          from public.therapy_faqs
          where therapy_faqs.therapy_id = therapies.id
        ) as faqs on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'id', event_rows.id,
              'eventType', event_rows.event_type,
              'reason', event_rows.reason,
              'createdAt', event_rows.created_at,
              'actorProfileId', event_rows.actor_profile_id
            )
            order by event_rows.created_at desc
          ) as items
          from (
            select *
            from public.therapy_catalog_events
            where therapy_catalog_events.entity_type = 'therapy'
              and therapy_catalog_events.entity_id = therapies.id
            order by therapy_catalog_events.created_at desc
            limit 8
          ) as event_rows
        ) as events on true
      ) as rows
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', therapy_catalog_requests.id,
          'informedName', therapy_catalog_requests.informed_name,
          'description', therapy_catalog_requests.description,
          'justification', therapy_catalog_requests.justification,
          'status', therapy_catalog_requests.status,
          'relatedTherapyId', therapy_catalog_requests.related_therapy_id,
          'decision', therapy_catalog_requests.decision,
          'createdAt', therapy_catalog_requests.created_at
        )
        order by therapy_catalog_requests.created_at desc
      )
      from public.therapy_catalog_requests
      where therapy_catalog_requests.status in (
        'submitted',
        'under_review',
        'needs_information'
      )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_assert_responsible_therapy_text_v1(
  p_value text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value ~* '(cura garantida|resultado garantido|diagn[oó]stico|tratamento m[eé]dico|transforma[cç][aã]o garantida)' then
    raise exception 'ADMIN_THERAPY_CATALOG_UNSAFE_COPY';
  end if;
end;
$$;

create or replace function public.admin_upsert_therapy_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_therapy_id uuid;
  v_existing public.therapies;
  v_old_slug text;
  v_old_state jsonb;
  v_slug text;
  v_name text;
  v_category_id uuid;
  v_short_description text;
  v_now timestamptz := now();
  v_next_state jsonb;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);
  v_therapy_id := nullif(p_payload->>'therapyId', '')::uuid;
  v_name := trim(coalesce(p_payload->>'name', ''));
  v_slug := trim(coalesce(p_payload->>'slug', ''));
  v_category_id := nullif(p_payload->>'categoryId', '')::uuid;
  v_short_description := trim(coalesce(p_payload->>'shortDescription', ''));

  if p_request_id is null or v_name = '' or v_slug = '' or v_category_id is null or v_short_description = '' then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_PAYLOAD';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_SLUG';
  end if;

  if not exists (
    select 1 from public.therapy_categories
    where id = v_category_id
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_CATEGORY_NOT_FOUND';
  end if;

  perform public.admin_assert_responsible_therapy_text_v1(
    concat_ws(
      ' ',
      v_name,
      v_short_description,
      p_payload->>'description',
      p_payload#>>'{publicContent,introduction}',
      p_payload#>>'{publicContent,complementaryDescription}',
      p_payload#>>'{publicContent,safetyNote}'
    )
  );

  if v_therapy_id is not null then
    select * into v_existing
    from public.therapies
    where id = v_therapy_id
    for update;

    if v_existing.id is null then
      raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
    end if;

    v_old_slug := v_existing.slug;
    v_old_state := to_jsonb(v_existing);

    if exists (
      select 1
      from public.therapies
      where slug = v_slug
        and id <> v_therapy_id
    ) then
      raise exception 'ADMIN_THERAPY_CATALOG_SLUG_CONFLICT';
    end if;

    update public.therapies
    set
      name = v_name,
      slug = v_slug,
      category_id = v_category_id,
      short_description = v_short_description,
      description = nullif(p_payload->>'description', ''),
      image_url = nullif(p_payload->>'imageUrl', ''),
      search_aliases = coalesce(
        array(
          select trim(value)::text
          from jsonb_array_elements_text(coalesce(p_payload->'aliases', '[]'::jsonb)) as value
          where trim(value) <> ''
        ),
        '{}'::text[]
      ),
      is_public_visible = coalesce((p_payload->>'isPubliclyVisible')::boolean, is_public_visible),
      is_available_for_services = coalesce((p_payload->>'isAvailableForServices')::boolean, is_available_for_services),
      is_featured = coalesce((p_payload->>'isFeatured')::boolean, is_featured),
      calendar_color_key = coalesce(nullif(p_payload->>'calendarColorKey', ''), calendar_color_key),
      updated_by_profile_id = v_actor.id,
      updated_at = v_now
    where id = v_therapy_id;

    if v_old_slug <> v_slug then
      insert into public.therapy_slug_redirects (
        old_slug,
        current_slug,
        therapy_id,
        created_by_profile_id
      )
      values (v_old_slug, v_slug, v_therapy_id, v_actor.id)
      on conflict (old_slug) do update
      set
        current_slug = excluded.current_slug,
        therapy_id = excluded.therapy_id,
        created_by_profile_id = excluded.created_by_profile_id;
    end if;
  else
    if exists (select 1 from public.therapies where slug = v_slug) then
      raise exception 'ADMIN_THERAPY_CATALOG_SLUG_CONFLICT';
    end if;

    insert into public.therapies (
      category_id,
      name,
      slug,
      short_description,
      description,
      status,
      is_public_visible,
      is_available_for_services,
      is_featured,
      image_url,
      search_aliases,
      calendar_color_key,
      created_by_profile_id,
      updated_by_profile_id
    )
    values (
      v_category_id,
      v_name,
      v_slug,
      v_short_description,
      nullif(p_payload->>'description', ''),
      'draft',
      coalesce((p_payload->>'isPubliclyVisible')::boolean, false),
      coalesce((p_payload->>'isAvailableForServices')::boolean, false),
      coalesce((p_payload->>'isFeatured')::boolean, false),
      nullif(p_payload->>'imageUrl', ''),
      coalesce(
        array(
          select trim(value)::text
          from jsonb_array_elements_text(coalesce(p_payload->'aliases', '[]'::jsonb)) as value
          where trim(value) <> ''
        ),
        '{}'::text[]
      ),
      coalesce(nullif(p_payload->>'calendarColorKey', ''), 'neutral'),
      v_actor.id,
      v_actor.id
    )
    returning id into v_therapy_id;

    v_old_state := null;
  end if;

  insert into public.therapy_public_content (
    therapy_id,
    hero_image_url,
    subtitle,
    introduction,
    complementary_description,
    safety_note,
    seo_title,
    seo_description,
    approach_label,
    approach_icon_key,
    visual_theme_key,
    hero_focal_point
  )
  values (
    v_therapy_id,
    nullif(p_payload#>>'{publicContent,heroImageUrl}', ''),
    nullif(p_payload#>>'{publicContent,subtitle}', ''),
    nullif(p_payload#>>'{publicContent,introduction}', ''),
    nullif(p_payload#>>'{publicContent,complementaryDescription}', ''),
    nullif(p_payload#>>'{publicContent,safetyNote}', ''),
    nullif(p_payload#>>'{publicContent,seoTitle}', ''),
    nullif(p_payload#>>'{publicContent,seoDescription}', ''),
    nullif(p_payload#>>'{publicContent,approachLabel}', ''),
    nullif(p_payload#>>'{publicContent,approachIconKey}', ''),
    coalesce(nullif(p_payload#>>'{publicContent,visualThemeKey}', ''), 'energy')::public.therapy_visual_theme_key,
    coalesce(nullif(p_payload#>>'{publicContent,heroFocalPoint}', ''), 'center')
  )
  on conflict (therapy_id) do update
  set
    hero_image_url = excluded.hero_image_url,
    subtitle = excluded.subtitle,
    introduction = excluded.introduction,
    complementary_description = excluded.complementary_description,
    safety_note = excluded.safety_note,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    approach_label = excluded.approach_label,
    approach_icon_key = excluded.approach_icon_key,
    visual_theme_key = excluded.visual_theme_key,
    hero_focal_point = excluded.hero_focal_point,
    updated_at = v_now;

  insert into public.matching_therapy_settings (
    therapy_id,
    is_visible_in_matching
  )
  values (
    v_therapy_id,
    coalesce((p_payload->>'isVisibleInMatching')::boolean, false)
  )
  on conflict (therapy_id) do update
  set
    is_visible_in_matching = excluded.is_visible_in_matching,
    updated_at = v_now;

  if p_payload ? 'highlights' then
    delete from public.therapy_highlights where therapy_id = v_therapy_id;
    insert into public.therapy_highlights (therapy_id, title, icon_key, sort_order)
    select
      v_therapy_id,
      trim(item->>'title'),
      coalesce(nullif(trim(item->>'iconKey'), ''), 'sparkles'),
      ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'highlights', '[]'::jsonb))
      with ordinality as items(item, ordinality)
    where trim(item->>'title') <> '';
  end if;

  if p_payload ? 'benefits' then
    delete from public.therapy_benefits where therapy_id = v_therapy_id;
    insert into public.therapy_benefits (therapy_id, title, description, icon_key, sort_order)
    select
      v_therapy_id,
      trim(item->>'title'),
      nullif(trim(item->>'description'), ''),
      coalesce(nullif(trim(item->>'iconKey'), ''), 'sparkles'),
      ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'benefits', '[]'::jsonb))
      with ordinality as items(item, ordinality)
    where trim(item->>'title') <> '';
  end if;

  if p_payload ? 'faqs' then
    delete from public.therapy_faqs where therapy_id = v_therapy_id;
    insert into public.therapy_faqs (therapy_id, question, answer, sort_order)
    select
      v_therapy_id,
      trim(item->>'question'),
      trim(item->>'answer'),
      ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'faqs', '[]'::jsonb))
      with ordinality as items(item, ordinality)
    where trim(item->>'question') <> ''
      and trim(item->>'answer') <> '';
  end if;

  select to_jsonb(therapies.*)
  into v_next_state
  from public.therapies
  where id = v_therapy_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id
  )
  values (
    v_actor.id,
    v_actor.role,
    'therapy',
    v_therapy_id,
    case when v_old_state is null then 'therapy_draft_created' else 'therapy_edited' end,
    v_old_state,
    v_next_state,
    nullif(p_payload->>'reason', ''),
    p_request_id
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapyId', v_therapy_id,
    'catalog', public.admin_list_therapy_catalog_v1(p_actor_user_id)
  );
end;
$$;

create or replace function public.admin_validate_therapy_publishable_v1(
  p_therapy_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_row record;
begin
  select
    therapies.*,
    therapy_categories.is_active as category_is_active,
    coalesce(therapy_public_content.hero_image_url, therapies.image_url) as effective_image_url,
    therapy_public_content.introduction,
    (select count(*) from public.therapy_highlights where therapy_id = therapies.id) as highlight_count,
    (select count(*) from public.therapy_benefits where therapy_id = therapies.id) as benefit_count,
    (select count(*) from public.therapy_faqs where therapy_id = therapies.id) as faq_count
  into v_row
  from public.therapies
  join public.therapy_categories
    on therapy_categories.id = therapies.category_id
  left join public.therapy_public_content
    on therapy_public_content.therapy_id = therapies.id
  where therapies.id = p_therapy_id;

  if v_row.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
  end if;

  if not v_row.category_is_active then
    raise exception 'ADMIN_THERAPY_CATALOG_INACTIVE_CATEGORY';
  end if;

  if v_row.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_SLUG';
  end if;

  if (
    coalesce(v_row.short_description, '') = ''
    or coalesce(v_row.introduction, v_row.description, '') = ''
    or coalesce(v_row.effective_image_url, '') = ''
    or v_row.highlight_count < 1
    or v_row.benefit_count < 1
    or v_row.faq_count < 1
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_INCOMPLETE_PUBLIC_CONTENT';
  end if;
end;
$$;

create or replace function public.admin_transition_therapy_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_therapy_id uuid,
  p_action text,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_old public.therapies;
  v_next public.therapies;
  v_impact jsonb;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  select *
  into v_old
  from public.therapies
  where id = p_therapy_id
  for update;

  if v_old.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'ADMIN_THERAPY_CATALOG_REASON_REQUIRED';
  end if;

  v_impact := public.admin_therapy_impact_v1(p_actor_user_id, p_therapy_id);

  if p_action = 'review' then
    update public.therapies
    set status = 'in_review',
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'publish' then
    perform public.admin_validate_therapy_publishable_v1(p_therapy_id);
    update public.therapies
    set status = 'published',
        published_at = coalesce(published_at, now()),
        archived_at = null,
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'unpublish' then
    update public.therapies
    set status = 'draft',
        is_public_visible = false,
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'deprecate' then
    update public.therapies
    set status = 'deprecated',
        is_available_for_services = false,
        replacement_therapy_id = nullif(p_payload->>'replacementTherapyId', '')::uuid,
        deprecated_at = now(),
        metadata = metadata || jsonb_build_object(
          'admin_message',
          nullif(p_payload->>'adminMessage', '')
        ),
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'archive' then
    if (v_impact->>'activeServiceCount')::integer > 0
      or (v_impact->>'futureBookingCount')::integer > 0 then
      raise exception 'ADMIN_THERAPY_CATALOG_ARCHIVE_BLOCKED_BY_USAGE';
    end if;

    update public.therapies
    set status = 'archived',
        is_public_visible = false,
        is_available_for_services = false,
        archived_at = now(),
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  else
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_ACTION';
  end if;

  if p_action in ('unpublish', 'deprecate', 'archive') then
    update public.matching_therapy_settings
    set is_visible_in_matching = false,
        updated_at = now()
    where therapy_id = p_therapy_id;
  end if;

  select *
  into v_next
  from public.therapies
  where id = p_therapy_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id,
    metadata
  )
  values (
    v_actor.id,
    v_actor.role,
    'therapy',
    p_therapy_id,
    'therapy_' || p_action,
    to_jsonb(v_old),
    to_jsonb(v_next),
    p_reason,
    p_request_id,
    jsonb_build_object('impactBefore', v_impact)
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapyId', p_therapy_id,
    'impactBefore', v_impact,
    'catalog', public.admin_list_therapy_catalog_v1(p_actor_user_id)
  );
end;
$$;

create or replace function public.submit_therapy_catalog_request_v1(
  p_actor_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_therapist_profile_id uuid;
  v_request_id uuid;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
begin
  select * into v_profile
  from public.profiles
  where id = p_actor_user_id
    and role = 'therapist';

  if v_profile.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  select id into v_therapist_profile_id
  from public.therapist_profiles
  where user_id = p_actor_user_id
  limit 1;

  insert into public.therapy_catalog_requests (
    requester_profile_id,
    requester_therapist_profile_id,
    informed_name,
    description,
    suggested_category_id,
    justification
  )
  values (
    p_actor_user_id,
    v_therapist_profile_id,
    v_name,
    nullif(p_payload->>'description', ''),
    nullif(p_payload->>'suggestedCategoryId', '')::uuid,
    nullif(p_payload->>'justification', '')
  )
  returning id into v_request_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    next_state
  )
  values (
    v_profile.id,
    v_profile.role,
    'therapy_catalog_request',
    v_request_id,
    'therapy_request_submitted',
    jsonb_build_object('status', 'submitted', 'informedName', v_name)
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'requestId', v_request_id,
    'status', 'submitted'
  );
end;
$$;

create or replace function public.admin_decide_therapy_catalog_request_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_catalog_request_id uuid,
  p_status text,
  p_decision text,
  p_related_therapy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_old public.therapy_catalog_requests;
  v_next public.therapy_catalog_requests;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  if p_status not in ('under_review', 'needs_information', 'approved', 'merged', 'rejected') then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_REQUEST_STATUS';
  end if;

  select * into v_old
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
  for update;

  if v_old.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  update public.therapy_catalog_requests
  set
    status = p_status,
    decision = nullif(p_decision, ''),
    related_therapy_id = p_related_therapy_id,
    decided_by_profile_id = case
      when p_status in ('approved', 'merged', 'rejected') then v_actor.id
      else decided_by_profile_id
    end,
    decided_at = case
      when p_status in ('approved', 'merged', 'rejected') then now()
      else decided_at
    end,
    updated_at = now()
  where id = p_catalog_request_id
  returning * into v_next;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id
  )
  values (
    v_actor.id,
    v_actor.role,
    'therapy_catalog_request',
    p_catalog_request_id,
    'therapy_request_' || p_status,
    to_jsonb(v_old),
    to_jsonb(v_next),
    p_decision,
    p_request_id
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'requestId', p_catalog_request_id,
    'catalog', public.admin_list_therapy_catalog_v1(p_actor_user_id)
  );
end;
$$;

revoke all on function public.admin_get_actor_profile_v1(uuid) from public;
revoke all on function public.admin_therapy_impact_v1(uuid, uuid) from public;
revoke all on function public.admin_list_therapy_catalog_v1(uuid) from public;
revoke all on function public.admin_assert_responsible_therapy_text_v1(text) from public;
revoke all on function public.admin_upsert_therapy_draft_v1(uuid, uuid, jsonb) from public;
revoke all on function public.admin_validate_therapy_publishable_v1(uuid) from public;
revoke all on function public.admin_transition_therapy_v1(uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.submit_therapy_catalog_request_v1(uuid, jsonb) from public;
revoke all on function public.admin_decide_therapy_catalog_request_v1(uuid, uuid, uuid, text, text, uuid) from public;

grant execute on function public.admin_list_therapy_catalog_v1(uuid) to service_role;
grant execute on function public.admin_therapy_impact_v1(uuid, uuid) to service_role;
grant execute on function public.admin_upsert_therapy_draft_v1(uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_transition_therapy_v1(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.submit_therapy_catalog_request_v1(uuid, jsonb) to service_role;
grant execute on function public.admin_decide_therapy_catalog_request_v1(uuid, uuid, uuid, text, text, uuid) to service_role;

comment on table public.therapy_catalog_requests is
  'Therapist-submitted requests for platform review of missing therapies. Approval does not publish free text automatically.';
comment on table public.therapy_catalog_events is
  'Sanitized audit trail for administrative catalog and therapy request changes.';
comment on table public.therapy_slug_redirects is
  'Persistent redirects for public therapy slugs changed by administrators.';
comment on column public.therapy_public_content.visual_theme_key is
  'Semantic key mapped by frontend tokens; never stores Tailwind or CSS classes.';
comment on column public.therapy_public_content.approach_icon_key is
  'Semantic icon key mapped by frontend code.';
comment on column public.therapy_public_content.hero_focal_point is
  'Semantic focal point key such as left, center, or right.';

create or replace view public.public_matching_therapies_v as
select
  public_therapy_details_v.id,
  public_therapy_details_v.name,
  public_therapy_details_v.slug,
  public_therapy_details_v.short_description,
  public_therapy_details_v.description,
  therapies.status,
  public_therapy_details_v.therapist_count,
  matching_therapy_settings.is_visible_in_matching
from public.public_therapy_details_v
join public.therapies
  on therapies.id = public_therapy_details_v.id
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = public_therapy_details_v.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and therapies.archived_at is null
  and matching_therapy_settings.is_visible_in_matching = true
  and exists (
    select 1
    from public.matching_weights
    join public.matching_versions
      on matching_versions.id = matching_weights.version_id
    where matching_weights.therapy_id = therapies.id
      and matching_weights.is_active = true
      and matching_versions.status = 'published'
  );

grant select on public.public_matching_therapies_v
to anon, authenticated, service_role;

comment on view public.public_matching_therapies_v is
  'Safe public projection for Match candidates. Requires published public therapy, explicit matching activation and weights in a published matching version.';
