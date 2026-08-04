create extension if not exists pgcrypto;

create table if not exists public.therapy_matching_themes (
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  theme_id uuid not null references public.matching_themes (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (therapy_id, theme_id)
);

create table if not exists public.therapist_service_matching_themes (
  therapist_service_id uuid not null references public.therapist_services (id) on delete cascade,
  theme_id uuid not null references public.matching_themes (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (therapist_service_id, theme_id)
);

create table if not exists public.therapist_service_matching_interests (
  therapist_service_id uuid not null references public.therapist_services (id) on delete cascade,
  interest_id uuid not null references public.matching_interests (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (therapist_service_id, interest_id)
);

create index if not exists therapy_matching_themes_theme_idx
  on public.therapy_matching_themes (theme_id, sort_order, therapy_id);
create index if not exists therapist_service_matching_themes_theme_idx
  on public.therapist_service_matching_themes (theme_id, therapist_service_id);
create index if not exists therapist_service_matching_interests_interest_idx
  on public.therapist_service_matching_interests (interest_id, therapist_service_id);

drop trigger if exists set_therapy_matching_themes_updated_at
on public.therapy_matching_themes;
create trigger set_therapy_matching_themes_updated_at
before update on public.therapy_matching_themes
for each row execute function public.set_updated_at();

insert into public.therapy_matching_themes (
  therapy_id,
  theme_id,
  sort_order
)
select
  matching_weights.therapy_id,
  matching_weights.theme_id,
  row_number() over (
    partition by matching_weights.therapy_id
    order by matching_weights.weight desc, matching_themes.sort_order asc, matching_themes.name asc
  )::integer as sort_order
from public.matching_weights
join public.matching_versions
  on matching_versions.id = matching_weights.version_id
join public.matching_themes
  on matching_themes.id = matching_weights.theme_id
where matching_versions.status = 'published'
  and matching_weights.is_active = true
  and matching_weights.theme_id is not null
on conflict (therapy_id, theme_id) do update
set
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.ensure_therapy_matching_theme_limit_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if exists (
    select 1
    from public.matching_themes
    where id = new.theme_id
      and is_active = false
  ) then
    raise exception 'INACTIVE_ENTITY';
  end if;

  select count(*)::integer
    into v_count
  from public.therapy_matching_themes
  where therapy_id = new.therapy_id;

  if v_count > 3 then
    raise exception 'LIMIT_EXCEEDED';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_therapy_matching_theme_limit
on public.therapy_matching_themes;
create constraint trigger ensure_therapy_matching_theme_limit
after insert or update on public.therapy_matching_themes
deferrable initially deferred
for each row execute function public.ensure_therapy_matching_theme_limit_v1();

create or replace function public.ensure_therapy_has_matching_theme_for_publish_v1(
  p_therapy_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.therapy_matching_themes
    join public.matching_themes
      on matching_themes.id = therapy_matching_themes.theme_id
    where therapy_matching_themes.therapy_id = p_therapy_id
      and matching_themes.is_active = true
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_THEME_REQUIRED';
  end if;
end;
$$;

create or replace function public.ensure_service_matching_rules_v1(
  p_service_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_therapy_id uuid;
  v_theme_count integer;
  v_invalid_theme_count integer;
  v_invalid_interest_count integer;
  v_excess_per_theme_count integer;
begin
  select therapy_id
    into v_therapy_id
  from public.therapist_services
  where id = p_service_id;

  if v_therapy_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select count(*)::integer
    into v_theme_count
  from public.therapist_service_matching_themes
  where therapist_service_id = p_service_id;

  if v_theme_count < 1 or v_theme_count > 3 then
    raise exception 'LIMIT_EXCEEDED';
  end if;

  select count(*)::integer
    into v_invalid_theme_count
  from public.therapist_service_matching_themes as service_theme
  left join public.therapy_matching_themes as therapy_theme
    on therapy_theme.therapy_id = v_therapy_id
    and therapy_theme.theme_id = service_theme.theme_id
  left join public.matching_themes as theme
    on theme.id = service_theme.theme_id
  where service_theme.therapist_service_id = p_service_id
    and (
      therapy_theme.theme_id is null
      or coalesce(theme.is_active, false) = false
    );

  if v_invalid_theme_count > 0 then
    raise exception 'INVALID_THEME_RELATION';
  end if;

  select count(*)::integer
    into v_invalid_interest_count
  from public.therapist_service_matching_interests as service_interest
  join public.matching_interests as interest
    on interest.id = service_interest.interest_id
  left join public.therapist_service_matching_themes as service_theme
    on service_theme.therapist_service_id = service_interest.therapist_service_id
    and service_theme.theme_id = interest.theme_id
  where service_interest.therapist_service_id = p_service_id
    and (
      service_theme.theme_id is null
      or interest.is_active = false
    );

  if v_invalid_interest_count > 0 then
    raise exception 'INVALID_INTEREST_RELATION';
  end if;

  select count(*)::integer
    into v_excess_per_theme_count
  from (
    select interest.theme_id
    from public.therapist_service_matching_interests as service_interest
    join public.matching_interests as interest
      on interest.id = service_interest.interest_id
    where service_interest.therapist_service_id = p_service_id
    group by interest.theme_id
    having count(*) > 3
  ) as excess;

  if v_excess_per_theme_count > 0 then
    raise exception 'LIMIT_EXCEEDED';
  end if;
end;
$$;

create or replace function public.validate_service_matching_write_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.ensure_service_matching_rules_v1(coalesce(new.therapist_service_id, old.therapist_service_id));
  return new;
end;
$$;

drop trigger if exists validate_service_matching_theme_write
on public.therapist_service_matching_themes;
create constraint trigger validate_service_matching_theme_write
after insert or update on public.therapist_service_matching_themes
deferrable initially deferred
for each row execute function public.validate_service_matching_write_v1();

drop trigger if exists validate_service_matching_interest_write
on public.therapist_service_matching_interests;
create constraint trigger validate_service_matching_interest_write
after insert or update on public.therapist_service_matching_interests
deferrable initially deferred
for each row execute function public.validate_service_matching_write_v1();

create or replace view public.public_matching_therapy_themes_v as
select
  therapy_matching_themes.therapy_id,
  therapy_matching_themes.theme_id,
  matching_themes.name as theme_name,
  matching_themes.slug as theme_slug,
  therapy_matching_themes.sort_order
from public.therapy_matching_themes
join public.matching_themes
  on matching_themes.id = therapy_matching_themes.theme_id
where matching_themes.is_active = true;

grant select on public.public_matching_therapy_themes_v to anon, authenticated, service_role;
grant select on public.therapy_matching_themes to authenticated, service_role;
grant select on public.therapist_service_matching_themes to authenticated, service_role;
grant select on public.therapist_service_matching_interests to authenticated, service_role;
grant select on public.matching_themes to service_role;
grant select on public.matching_interests to service_role;
grant all on public.therapy_matching_themes to service_role;
grant all on public.therapist_service_matching_themes to service_role;
grant all on public.therapist_service_matching_interests to service_role;

alter table public.therapy_matching_themes enable row level security;
alter table public.therapist_service_matching_themes enable row level security;
alter table public.therapist_service_matching_interests enable row level security;

alter table public.therapy_catalog_events
  drop constraint if exists therapy_catalog_events_entity_check;

alter table public.therapy_catalog_events
  add constraint therapy_catalog_events_entity_check check (
    entity_type in (
      'therapy',
      'therapy_catalog_request',
      'matching_theme',
      'matching_interest'
    )
  );

drop policy if exists "Admins can read therapy matching themes"
on public.therapy_matching_themes;
create policy "Admins can read therapy matching themes"
on public.therapy_matching_themes
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Therapists can read own service matching themes"
on public.therapist_service_matching_themes;
create policy "Therapists can read own service matching themes"
on public.therapist_service_matching_themes
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_services
    where therapist_services.id = therapist_service_matching_themes.therapist_service_id
      and public.is_current_therapist_profile(therapist_services.therapist_profile_id)
  )
);

drop policy if exists "Therapists can read own service matching interests"
on public.therapist_service_matching_interests;
create policy "Therapists can read own service matching interests"
on public.therapist_service_matching_interests
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_services
    where therapist_services.id = therapist_service_matching_interests.therapist_service_id
      and public.is_current_therapist_profile(therapist_services.therapist_profile_id)
  )
);

create or replace view public.therapist_service_allowed_catalog_v1 as
select
  therapies.id as therapy_id,
  therapies.name as therapy_name,
  therapies.slug as therapy_slug,
  therapies.short_description,
  therapies.status as therapy_status,
  therapies.is_public_visible,
  therapies.is_available_for_services,
  therapy_categories.id as category_id,
  therapy_categories.name as category_name,
  therapy_categories.slug as category_slug,
  therapy_categories.sort_order as category_sort_order,
  coalesce(
    matching_therapy_settings.is_visible_in_matching,
    false
  ) as is_visible_in_matching,
  therapies.updated_at,
  coalesce(theme_projection.themes, '[]'::jsonb) as matching_themes
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = therapies.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', matching_themes.id,
      'name', matching_themes.name,
      'slug', matching_themes.slug,
      'sortOrder', therapy_matching_themes.sort_order,
      'interests', coalesce(interest_projection.interests, '[]'::jsonb)
    )
    order by therapy_matching_themes.sort_order asc, matching_themes.name asc
  ) as themes
  from public.therapy_matching_themes
  join public.matching_themes
    on matching_themes.id = therapy_matching_themes.theme_id
    and matching_themes.is_active = true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', matching_interests.id,
        'name', matching_interests.name,
        'slug', matching_interests.slug,
        'sortOrder', matching_interests.sort_order,
        'themeId', matching_interests.theme_id
      )
      order by matching_interests.sort_order asc, matching_interests.name asc
    ) as interests
    from public.matching_interests
    where matching_interests.theme_id = matching_themes.id
      and matching_interests.is_active = true
  ) as interest_projection on true
  where therapy_matching_themes.therapy_id = therapies.id
) as theme_projection on true
where therapies.status = 'published'
  and therapies.is_available_for_services = true
  and therapy_categories.is_active = true;

create or replace function public.service_row_to_private_json_v1(
  p_service_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.therapist_private_services_v1%rowtype;
  v_matching jsonb;
begin
  select *
    into v_service
  from public.therapist_private_services_v1
  where service_id = p_service_id;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'themeIds', coalesce(jsonb_agg(distinct service_theme.theme_id) filter (where service_theme.theme_id is not null), '[]'::jsonb),
    'interestIds', coalesce(jsonb_agg(distinct service_interest.interest_id) filter (where service_interest.interest_id is not null), '[]'::jsonb)
  )
    into v_matching
  from public.therapist_services as service
  left join public.therapist_service_matching_themes as service_theme
    on service_theme.therapist_service_id = service.id
  left join public.therapist_service_matching_interests as service_interest
    on service_interest.therapist_service_id = service.id
  where service.id = p_service_id;

  return jsonb_build_object(
    'serviceId', v_service.service_id,
    'therapyId', v_service.therapy_id,
    'therapy', jsonb_build_object(
      'id', v_service.therapy_id,
      'name', v_service.therapy_name,
      'slug', v_service.therapy_slug,
      'status', v_service.therapy_status,
      'isPubliclyVisible', v_service.therapy_is_public_visible,
      'isAvailableForServices', v_service.is_available_for_services
    ),
    'category', jsonb_build_object(
      'id', v_service.category_id,
      'name', v_service.category_name,
      'slug', v_service.category_slug
    ),
    'matching', coalesce(v_matching, jsonb_build_object('themeIds', '[]'::jsonb, 'interestIds', '[]'::jsonb)),
    'status', v_service.status,
    'title', v_service.title,
    'description', v_service.description,
    'durationMinutes', v_service.duration_minutes,
    'priceCents', v_service.price_cents,
    'currency', v_service.currency,
    'deliveryFormat', v_service.delivery_format,
    'onlineOnly', v_service.online_only,
    'isBookable', v_service.is_bookable,
    'position', v_service.position,
    'version', v_service.version,
    'isReservable', v_service.is_reservable,
    'blockingReason', v_service.blocking_reason,
    'metrics', jsonb_build_object(
      'bookingCount', v_service.booking_count,
      'bookingsLast30Days', v_service.bookings_last_30_days,
      'bookingCountDeltaPercent', v_service.booking_count_delta_percent
    ),
    'createdAt', v_service.created_at,
    'updatedAt', v_service.updated_at,
    'archivedAt', v_service.archived_at
  );
end;
$$;

create or replace function public.get_public_therapy_therapists_v1(
  p_therapy_slug text,
  p_theme_ids uuid[] default '{}'::uuid[],
  p_interest_ids uuid[] default '{}'::uuid[],
  p_limit integer default 6
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapy_id uuid;
  v_relevant_theme_ids uuid[];
  v_relevant_interest_ids uuid[];
begin
  select therapies.id
    into v_therapy_id
  from public.therapies
  join public.therapy_categories
    on therapy_categories.id = therapies.category_id
  where therapies.slug = p_therapy_slug
    and therapies.status = 'published'
    and therapies.is_public_visible = true
    and therapy_categories.is_active = true;

  if v_therapy_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct theme_id), '{}'::uuid[])
    into v_relevant_theme_ids
  from public.therapy_matching_themes
  where therapy_id = v_therapy_id
    and theme_id = any(coalesce(p_theme_ids, '{}'::uuid[]));

  select coalesce(array_agg(distinct interest.id), '{}'::uuid[])
    into v_relevant_interest_ids
  from public.matching_interests as interest
  where interest.id = any(coalesce(p_interest_ids, '{}'::uuid[]))
    and interest.theme_id = any(v_relevant_theme_ids)
    and interest.is_active = true;

  return coalesce((
    select jsonb_agg(row_to_json(ranked) order by ranked.matching_interest_count desc, ranked.matching_service_theme_count desc, ranked.next_slot_at asc nulls last, ranked.average_rating desc nulls last, ranked.review_count desc, ranked.slug asc)
    from (
      select
        public_search.slug,
        public_search.public_name,
        public_search.photo_url,
        public_search.therapist_headline,
        public_search.service_description,
        coalesce(public_search.tags, '{}'::text[]) as tags,
        public_search.average_rating,
        public_search.review_count,
        0::integer as completed_session_count,
        public_search.next_slot_at,
        public_search.service_id,
        coalesce(interest_matches.matching_interest_count, 0)::integer as matching_interest_count,
        coalesce(theme_matches.matching_service_theme_count, 0)::integer as matching_service_theme_count
      from public.public_therapist_search as public_search
      left join lateral (
        select count(distinct service_interest.interest_id)::integer as matching_interest_count
        from public.therapist_service_matching_interests as service_interest
        where service_interest.therapist_service_id = public_search.service_id
          and service_interest.interest_id = any(v_relevant_interest_ids)
      ) as interest_matches on true
      left join lateral (
        select count(distinct service_theme.theme_id)::integer as matching_service_theme_count
        from public.therapist_service_matching_themes as service_theme
        where service_theme.therapist_service_id = public_search.service_id
          and service_theme.theme_id = any(v_relevant_theme_ids)
      ) as theme_matches on true
      where public_search.therapy_id = v_therapy_id
      order by
        case when cardinality(v_relevant_interest_ids) > 0 then coalesce(interest_matches.matching_interest_count, 0) else 0 end desc,
        coalesce(theme_matches.matching_service_theme_count, 0) desc,
        public_search.next_slot_at asc nulls last,
        public_search.average_rating desc nulls last,
        public_search.review_count desc,
        public_search.slug asc
      limit least(greatest(coalesce(p_limit, 6), 1), 24)
    ) as ranked
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_replace_therapy_matching_themes_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_therapy_id uuid,
  p_theme_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_theme_count integer;
  v_previous_state jsonb;
  v_next_state jsonb;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  if p_request_id is null or p_therapy_id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1
    from public.therapies
    where id = p_therapy_id
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
  end if;

  select count(distinct theme_id)::integer
    into v_theme_count
  from unnest(coalesce(p_theme_ids, '{}'::uuid[])) as theme_id
  join public.matching_themes
    on matching_themes.id = theme_id
    and matching_themes.is_active = true;

  if v_theme_count < 1 or v_theme_count > 3 then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT';
  end if;

  if v_theme_count <> coalesce(array_length(p_theme_ids, 1), 0) then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('themeId', theme_id, 'sortOrder', sort_order) order by sort_order),
    '[]'::jsonb
  )
    into v_previous_state
  from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

  delete from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

  insert into public.therapy_matching_themes (
    therapy_id,
    theme_id,
    sort_order
  )
  select
    p_therapy_id,
    theme_id,
    ordinality::integer
  from unnest(p_theme_ids) with ordinality as themes(theme_id, ordinality);

  select coalesce(
    jsonb_agg(jsonb_build_object('themeId', theme_id, 'sortOrder', sort_order) order by sort_order),
    '[]'::jsonb
  )
    into v_next_state
  from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

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
    'therapy_matching_themes_replaced',
    v_previous_state,
    v_next_state,
    nullif(p_reason, ''),
    p_request_id,
    jsonb_build_object('source', 'admin_matching_foundation')
  );

  return public.admin_list_therapy_catalog_v1(p_actor_user_id);
end;
$$;

create or replace function public.admin_list_matching_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_get_actor_profile_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'themes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', theme.id,
          'name', theme.name,
          'slug', theme.slug,
          'description', theme.description,
          'imageUrl', theme.image_url,
          'sortOrder', theme.sort_order,
          'isActive', theme.is_active,
          'therapyCount', coalesce(therapy_count.count, 0),
          'serviceCount', coalesce(service_count.count, 0),
          'createdAt', theme.created_at,
          'updatedAt', theme.updated_at,
          'interests', coalesce(interest_rows.items, '[]'::jsonb),
          'history', coalesce(event_rows.items, '[]'::jsonb)
        )
        order by theme.sort_order asc, theme.name asc
      )
      from public.matching_themes as theme
      left join lateral (
        select count(distinct therapy_id)::integer as count
        from public.therapy_matching_themes
        where theme_id = theme.id
      ) as therapy_count on true
      left join lateral (
        select count(distinct therapist_service_id)::integer as count
        from public.therapist_service_matching_themes
        where theme_id = theme.id
      ) as service_count on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', interest.id,
            'themeId', interest.theme_id,
            'name', interest.name,
            'slug', interest.slug,
            'sortOrder', interest.sort_order,
            'isActive', interest.is_active,
            'serviceCount', coalesce(interest_service_count.count, 0),
            'createdAt', interest.created_at,
            'updatedAt', interest.updated_at,
            'history', coalesce(interest_event_rows.items, '[]'::jsonb)
          )
          order by interest.sort_order asc, interest.name asc
        ) as items
        from public.matching_interests as interest
        left join lateral (
          select count(distinct therapist_service_id)::integer as count
          from public.therapist_service_matching_interests
          where interest_id = interest.id
        ) as interest_service_count on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'id', event.id,
              'eventType', event.event_type,
              'reason', event.reason,
              'createdAt', event.created_at,
              'actorProfileId', event.actor_profile_id
            )
            order by event.created_at desc
          ) as items
          from (
            select *
            from public.therapy_catalog_events
            where entity_type = 'matching_interest'
              and entity_id = interest.id
            order by created_at desc
            limit 8
          ) as event
        ) as interest_event_rows on true
        where interest.theme_id = theme.id
      ) as interest_rows on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', event.id,
            'eventType', event.event_type,
            'reason', event.reason,
            'createdAt', event.created_at,
            'actorProfileId', event.actor_profile_id
          )
          order by event.created_at desc
        ) as items
        from (
          select *
          from public.therapy_catalog_events
          where entity_type = 'matching_theme'
            and entity_id = theme.id
          order by created_at desc
          limit 8
        ) as event
      ) as event_rows on true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert_matching_theme_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_theme_id uuid;
  v_existing public.matching_themes%rowtype;
  v_old_state jsonb;
  v_next_state jsonb;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_slug text := btrim(coalesce(p_payload->>'slug', ''));
  v_description text := btrim(coalesce(p_payload->>'description', ''));
  v_sort_order integer := coalesce(nullif(p_payload->>'sortOrder', '')::integer, 0);
  v_reason text := btrim(coalesce(p_payload->>'reason', ''));
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);
  v_theme_id := nullif(p_payload->>'themeId', '')::uuid;

  if p_request_id is null
    or length(v_name) < 2
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(v_description) < 4
    or length(v_reason) < 4 then
    raise exception 'ADMIN_MATCHING_INVALID_PAYLOAD';
  end if;

  if v_theme_id is not null then
    select * into v_existing
    from public.matching_themes
    where id = v_theme_id
    for update;

    if not found then
      raise exception 'ADMIN_MATCHING_THEME_NOT_FOUND';
    end if;

    if exists (
      select 1 from public.matching_themes
      where slug = v_slug
        and id <> v_theme_id
    ) then
      raise exception 'ADMIN_MATCHING_SLUG_CONFLICT';
    end if;

    v_old_state := to_jsonb(v_existing);

    update public.matching_themes
    set
      name = v_name,
      slug = v_slug,
      description = v_description,
      image_url = nullif(p_payload->>'imageUrl', ''),
      sort_order = v_sort_order,
      updated_at = now()
    where id = v_theme_id;
  else
    if exists (select 1 from public.matching_themes where slug = v_slug) then
      raise exception 'ADMIN_MATCHING_SLUG_CONFLICT';
    end if;

    insert into public.matching_themes (
      name,
      slug,
      description,
      image_url,
      sort_order,
      is_active
    )
    values (
      v_name,
      v_slug,
      v_description,
      nullif(p_payload->>'imageUrl', ''),
      v_sort_order,
      true
    )
    returning id into v_theme_id;

    v_old_state := null;
  end if;

  select to_jsonb(theme.*)
    into v_next_state
  from public.matching_themes as theme
  where theme.id = v_theme_id;

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
    'matching_theme',
    v_theme_id,
    case when v_old_state is null then 'matching_theme_created' else 'matching_theme_updated' end,
    v_old_state,
    v_next_state,
    v_reason,
    p_request_id
  );

  return public.admin_list_matching_v1(p_actor_user_id);
end;
$$;

create or replace function public.admin_upsert_matching_interest_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_interest_id uuid;
  v_theme_id uuid := nullif(p_payload->>'themeId', '')::uuid;
  v_existing public.matching_interests%rowtype;
  v_old_state jsonb;
  v_next_state jsonb;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_slug text := btrim(coalesce(p_payload->>'slug', ''));
  v_sort_order integer := coalesce(nullif(p_payload->>'sortOrder', '')::integer, 0);
  v_reason text := btrim(coalesce(p_payload->>'reason', ''));
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);
  v_interest_id := nullif(p_payload->>'interestId', '')::uuid;

  if p_request_id is null
    or v_theme_id is null
    or length(v_name) < 2
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(v_reason) < 4 then
    raise exception 'ADMIN_MATCHING_INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1 from public.matching_themes
    where id = v_theme_id
      and is_active = true
  ) then
    raise exception 'ADMIN_MATCHING_THEME_NOT_FOUND';
  end if;

  if v_interest_id is not null then
    select * into v_existing
    from public.matching_interests
    where id = v_interest_id
    for update;

    if not found then
      raise exception 'ADMIN_MATCHING_INTEREST_NOT_FOUND';
    end if;

    if v_existing.theme_id <> v_theme_id then
      raise exception 'ADMIN_MATCHING_INTEREST_THEME_LOCKED';
    end if;

    if exists (
      select 1 from public.matching_interests
      where slug = v_slug
        and id <> v_interest_id
    ) then
      raise exception 'ADMIN_MATCHING_SLUG_CONFLICT';
    end if;

    v_old_state := to_jsonb(v_existing);

    update public.matching_interests
    set
      name = v_name,
      slug = v_slug,
      sort_order = v_sort_order,
      updated_at = now()
    where id = v_interest_id;
  else
    if exists (select 1 from public.matching_interests where slug = v_slug) then
      raise exception 'ADMIN_MATCHING_SLUG_CONFLICT';
    end if;

    insert into public.matching_interests (
      theme_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      v_theme_id,
      v_name,
      v_slug,
      v_sort_order,
      true
    )
    returning id into v_interest_id;

    v_old_state := null;
  end if;

  select to_jsonb(interest.*)
    into v_next_state
  from public.matching_interests as interest
  where interest.id = v_interest_id;

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
    'matching_interest',
    v_interest_id,
    case when v_old_state is null then 'matching_interest_created' else 'matching_interest_updated' end,
    v_old_state,
    v_next_state,
    v_reason,
    p_request_id
  );

  return public.admin_list_matching_v1(p_actor_user_id);
end;
$$;

create or replace function public.admin_transition_matching_entity_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_old_state jsonb;
  v_next_state jsonb;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  if p_request_id is null
    or p_entity_id is null
    or p_entity_type not in ('theme', 'interest')
    or p_action not in ('activate', 'deactivate')
    or length(btrim(coalesce(p_reason, ''))) < 4 then
    raise exception 'ADMIN_MATCHING_INVALID_PAYLOAD';
  end if;

  if p_entity_type = 'theme' then
    select to_jsonb(theme.*)
      into v_old_state
    from public.matching_themes as theme
    where theme.id = p_entity_id
    for update;

    if v_old_state is null then
      raise exception 'ADMIN_MATCHING_THEME_NOT_FOUND';
    end if;

    if p_action = 'deactivate' and exists (
      select 1
      from public.therapy_matching_themes as candidate
      join public.therapies
        on therapies.id = candidate.therapy_id
      left join public.matching_therapy_settings
        on matching_therapy_settings.therapy_id = therapies.id
      where candidate.theme_id = p_entity_id
        and therapies.status = 'published'
        and therapies.is_public_visible = true
        and coalesce(matching_therapy_settings.is_visible_in_matching, false) = true
        and (
          select count(*)::integer
          from public.therapy_matching_themes as sibling
          join public.matching_themes as sibling_theme
            on sibling_theme.id = sibling.theme_id
          where sibling.therapy_id = candidate.therapy_id
            and sibling.theme_id <> p_entity_id
            and sibling_theme.is_active = true
        ) = 0
    ) then
      raise exception 'ADMIN_MATCHING_THEME_DEACTIVATION_BLOCKED';
    end if;

    update public.matching_themes
    set
      is_active = p_action = 'activate',
      updated_at = now()
    where id = p_entity_id;

    select to_jsonb(theme.*)
      into v_next_state
    from public.matching_themes as theme
    where theme.id = p_entity_id;

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
      'matching_theme',
      p_entity_id,
      case when p_action = 'activate' then 'matching_theme_activated' else 'matching_theme_deactivated' end,
      v_old_state,
      v_next_state,
      p_reason,
      p_request_id
    );
  else
    select to_jsonb(interest.*)
      into v_old_state
    from public.matching_interests as interest
    where interest.id = p_entity_id
    for update;

    if v_old_state is null then
      raise exception 'ADMIN_MATCHING_INTEREST_NOT_FOUND';
    end if;

    update public.matching_interests
    set
      is_active = p_action = 'activate',
      updated_at = now()
    where id = p_entity_id;

    select to_jsonb(interest.*)
      into v_next_state
    from public.matching_interests as interest
    where interest.id = p_entity_id;

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
      'matching_interest',
      p_entity_id,
      case when p_action = 'activate' then 'matching_interest_activated' else 'matching_interest_deactivated' end,
      v_old_state,
      v_next_state,
      p_reason,
      p_request_id
    );
  end if;

  return public.admin_list_matching_v1(p_actor_user_id);
end;
$$;

create or replace function public.admin_upsert_therapy_draft_with_matching_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_therapy_id uuid;
  v_theme_ids uuid[];
begin
  v_result := public.admin_upsert_therapy_draft_v1(
    p_actor_user_id,
    p_request_id,
    p_payload
  );
  v_therapy_id := (v_result->>'therapyId')::uuid;

  if p_payload ? 'themeIds' then
    select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
      into v_theme_ids
    from jsonb_array_elements_text(coalesce(p_payload->'themeIds', '[]'::jsonb))
      with ordinality as items(value, ordinality);

    v_result := jsonb_build_object(
      'contractVersion', 1,
      'therapyId', v_therapy_id,
      'catalog', public.admin_replace_therapy_matching_themes_v1(
        p_actor_user_id,
        p_request_id,
        v_therapy_id,
        v_theme_ids,
        p_payload->>'reason'
      )
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.replace_therapist_service_matching_v1(
  p_actor_user_id uuid,
  p_service_id uuid,
  p_theme_ids uuid[],
  p_interest_ids uuid[],
  p_request_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_service public.therapist_services%rowtype;
  v_previous jsonb;
  v_next jsonb;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);

  select *
    into v_service
  from public.therapist_services
  where id = p_service_id
    and therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'THERAPIST_SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'themeIds', coalesce(jsonb_agg(distinct service_theme.theme_id) filter (where service_theme.theme_id is not null), '[]'::jsonb),
    'interestIds', coalesce(jsonb_agg(distinct service_interest.interest_id) filter (where service_interest.interest_id is not null), '[]'::jsonb)
  )
    into v_previous
  from public.therapist_services as service
  left join public.therapist_service_matching_themes as service_theme
    on service_theme.therapist_service_id = service.id
  left join public.therapist_service_matching_interests as service_interest
    on service_interest.therapist_service_id = service.id
  where service.id = p_service_id;

  delete from public.therapist_service_matching_interests
  where therapist_service_id = p_service_id;
  delete from public.therapist_service_matching_themes
  where therapist_service_id = p_service_id;

  insert into public.therapist_service_matching_themes (
    therapist_service_id,
    theme_id
  )
  select p_service_id, theme_id
  from unnest(coalesce(p_theme_ids, '{}'::uuid[])) as theme_id;

  insert into public.therapist_service_matching_interests (
    therapist_service_id,
    interest_id
  )
  select p_service_id, interest_id
  from unnest(coalesce(p_interest_ids, '{}'::uuid[])) as interest_id;

  perform public.ensure_service_matching_rules_v1(p_service_id);

  select jsonb_build_object(
    'themeIds', coalesce(jsonb_agg(distinct service_theme.theme_id) filter (where service_theme.theme_id is not null), '[]'::jsonb),
    'interestIds', coalesce(jsonb_agg(distinct service_interest.interest_id) filter (where service_interest.interest_id is not null), '[]'::jsonb)
  )
    into v_next
  from public.therapist_services as service
  left join public.therapist_service_matching_themes as service_theme
    on service_theme.therapist_service_id = service.id
  left join public.therapist_service_matching_interests as service_interest
    on service_interest.therapist_service_id = service.id
  where service.id = p_service_id;

  insert into public.therapist_service_events (
    therapist_profile_id,
    service_id,
    actor_user_id,
    event_type,
    request_id,
    previous_version,
    resulting_version,
    metadata
  )
  values (
    v_therapist.id,
    p_service_id,
    p_actor_user_id,
    'service_updated',
    p_request_id,
    v_service.version,
    v_service.version,
    jsonb_build_object(
      'matchingPrevious', coalesce(v_previous, '{}'::jsonb),
      'matchingNext', coalesce(v_next, '{}'::jsonb)
    )
  );
end;
$$;

create or replace function public.create_therapist_service_with_matching_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_service_id uuid;
  v_theme_ids uuid[];
  v_interest_ids uuid[];
begin
  v_result := public.create_therapist_service_v1(
    p_actor_user_id,
    p_request_id,
    p_payload
  );
  v_service_id := (v_result#>>'{service,serviceId}')::uuid;

  select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
    into v_theme_ids
  from jsonb_array_elements_text(coalesce(p_payload->'themeIds', '[]'::jsonb))
    with ordinality as items(value, ordinality);

  select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
    into v_interest_ids
  from jsonb_array_elements_text(coalesce(p_payload->'interestIds', '[]'::jsonb))
    with ordinality as items(value, ordinality);

  perform public.replace_therapist_service_matching_v1(
    p_actor_user_id,
    v_service_id,
    v_theme_ids,
    v_interest_ids,
    p_request_id
  );

  return jsonb_set(
    v_result,
    '{service}',
    public.service_row_to_private_json_v1(v_service_id),
    true
  );
end;
$$;

create or replace function public.list_therapist_service_catalog_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'serviceLimit', public.therapist_service_limit_for_plan_v1(v_therapist.plan),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'therapyId', catalog.therapy_id,
            'name', catalog.therapy_name,
            'slug', catalog.therapy_slug,
            'shortDescription', catalog.short_description,
            'category', jsonb_build_object(
              'id', catalog.category_id,
              'name', catalog.category_name,
              'slug', catalog.category_slug
            ),
            'status', catalog.therapy_status,
            'isPubliclyVisible', catalog.is_public_visible,
            'isAvailableForServices', catalog.is_available_for_services,
            'isVisibleInMatching', catalog.is_visible_in_matching,
            'matchingThemes', catalog.matching_themes
          )
          order by catalog.category_sort_order, catalog.therapy_name
        ),
        '[]'::jsonb
      )
      from public.therapist_service_allowed_catalog_v1 as catalog
    )
  );
end;
$$;

create or replace function public.list_private_therapist_services_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'serviceLimit', public.therapist_service_limit_for_plan_v1(v_therapist.plan),
    'items', (
      select coalesce(
        jsonb_agg(
          public.service_row_to_private_json_v1(service.service_id)
          order by service.position, service.created_at, service.service_id
        ),
        '[]'::jsonb
      )
      from public.therapist_private_services_v1 as service
      where service.therapist_profile_id = v_therapist.id
    )
  );
end;
$$;

create or replace function public.update_therapist_service_with_matching_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_service_id uuid,
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
  v_result jsonb;
  v_theme_ids uuid[];
  v_interest_ids uuid[];
begin
  v_result := public.update_therapist_service_v1(
    p_actor_user_id,
    p_request_id,
    p_service_id,
    p_expected_version,
    p_payload
  );

  if p_payload ? 'themeIds' or p_payload ? 'interestIds' then
    select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
      into v_theme_ids
    from jsonb_array_elements_text(coalesce(p_payload->'themeIds', '[]'::jsonb))
      with ordinality as items(value, ordinality);

    select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
      into v_interest_ids
    from jsonb_array_elements_text(coalesce(p_payload->'interestIds', '[]'::jsonb))
      with ordinality as items(value, ordinality);

    perform public.replace_therapist_service_matching_v1(
      p_actor_user_id,
      p_service_id,
      v_theme_ids,
      v_interest_ids,
      p_request_id
    );

    v_result := jsonb_set(
      v_result,
      '{service}',
      public.service_row_to_private_json_v1(p_service_id),
      true
    );
  end if;

  return v_result;
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

  perform public.ensure_therapy_has_matching_theme_for_publish_v1(p_therapy_id);
end;
$$;

revoke all on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer) from public;
grant execute on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)
  to anon, authenticated, service_role;
revoke all on function public.admin_replace_therapy_matching_themes_v1(uuid, uuid, uuid, uuid[], text) from public;
revoke all on function public.admin_list_matching_v1(uuid) from public;
revoke all on function public.admin_upsert_matching_theme_v1(uuid, uuid, jsonb) from public;
revoke all on function public.admin_upsert_matching_interest_v1(uuid, uuid, jsonb) from public;
revoke all on function public.admin_transition_matching_entity_v1(uuid, uuid, text, uuid, text, text) from public;
revoke all on function public.admin_upsert_therapy_draft_with_matching_v1(uuid, uuid, jsonb) from public;
revoke all on function public.replace_therapist_service_matching_v1(uuid, uuid, uuid[], uuid[], uuid) from public;
revoke all on function public.create_therapist_service_with_matching_v1(uuid, uuid, jsonb) from public;
revoke all on function public.update_therapist_service_with_matching_v1(uuid, uuid, uuid, bigint, jsonb) from public;
grant execute on function public.admin_replace_therapy_matching_themes_v1(uuid, uuid, uuid, uuid[], text)
  to service_role;
grant execute on function public.admin_list_matching_v1(uuid)
  to service_role;
grant execute on function public.admin_upsert_matching_theme_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.admin_upsert_matching_interest_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.admin_transition_matching_entity_v1(uuid, uuid, text, uuid, text, text)
  to service_role;
grant execute on function public.admin_upsert_therapy_draft_with_matching_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.replace_therapist_service_matching_v1(uuid, uuid, uuid[], uuid[], uuid)
  to service_role;
grant execute on function public.create_therapist_service_with_matching_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.update_therapist_service_with_matching_v1(uuid, uuid, uuid, bigint, jsonb)
  to service_role;

comment on table public.therapy_matching_themes is
  'Canonical admin-managed relationship: themes recommend therapies. Max three themes per therapy.';
comment on table public.therapist_service_matching_themes is
  'Therapist service-specific themes chosen from the therapy canonical theme set.';
comment on table public.therapist_service_matching_interests is
  'Therapist service-specific refinements; each refinement must belong to a selected service theme.';
comment on view public.public_matching_therapy_themes_v is
  'Public-safe therapy-theme relationship used by Match. Refinements are intentionally absent from therapy scoring.';
