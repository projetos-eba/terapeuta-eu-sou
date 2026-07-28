create extension if not exists pgcrypto;

alter table public.therapies
  add column if not exists is_available_for_services boolean not null default false,
  add column if not exists created_by_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists updated_by_profile_id uuid references public.profiles (id) on delete set null;

update public.therapies
set
  is_available_for_services = true,
  updated_at = now()
where status = 'published'
  and is_public_visible = true
  and exists (
    select 1
    from public.therapy_categories as category
    where category.id = therapies.category_id
      and category.is_active = true
  );

alter table public.therapist_services
  add column if not exists delivery_format text not null default 'online',
  add column if not exists is_bookable boolean not null default true,
  add column if not exists position integer not null default 0,
  add column if not exists version bigint not null default 1,
  add column if not exists archived_at timestamptz;

update public.therapist_services
set
  is_bookable = case when status = 'active' then true else false end,
  delivery_format = case when online_only then 'online' else delivery_format end,
  position = coalesce(nullif(position, 0), 10),
  updated_at = now();

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_duration_range
    check (duration_minutes between 15 and 240);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_price_cents_range
    check (price_cents between 0 and 2000000);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_active_price_required
    check (status <> 'active' or price_cents >= 1000);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_currency_uppercase
    check (currency = upper(currency));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_delivery_format_check
    check (delivery_format in ('online', 'in_person', 'hybrid'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.therapist_services
    add constraint therapist_services_position_non_negative
    check (position >= 0);
exception when duplicate_object then null;
end $$;

create index if not exists therapist_services_therapist_status_idx
  on public.therapist_services (therapist_profile_id, status);

create index if not exists therapist_services_therapy_status_idx
  on public.therapist_services (therapy_id, status);

create index if not exists therapist_services_private_order_idx
  on public.therapist_services (therapist_profile_id, position, created_at);

create index if not exists therapist_services_public_bookable_idx
  on public.therapist_services (
    therapy_id,
    status,
    is_bookable,
    delivery_format
  );

create index if not exists therapies_status_serviceable_idx
  on public.therapies (status, is_available_for_services);

create index if not exists therapies_category_status_idx
  on public.therapies (category_id, status);

create index if not exists therapies_slug_idx
  on public.therapies (slug);

create table if not exists public.therapist_service_mutation_requests (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  payload_hash text not null,
  service_id uuid references public.therapist_services (id) on delete set null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_service_mutation_requests_operation_check check (
    operation in ('create', 'update', 'activate', 'pause', 'archive', 'reorder')
  ),
  constraint therapist_service_mutation_requests_unique unique (
    therapist_profile_id,
    request_id
  )
);

create table if not exists public.therapist_service_events (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  service_id uuid references public.therapist_services (id) on delete set null,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null,
  request_id uuid,
  previous_status public.service_status,
  next_status public.service_status,
  previous_version bigint,
  resulting_version bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint therapist_service_events_type_check check (
    event_type in (
      'service_created',
      'service_updated',
      'service_activated',
      'service_paused',
      'service_archived',
      'services_reordered'
    )
  )
);

drop trigger if exists set_therapist_service_mutation_requests_updated_at
on public.therapist_service_mutation_requests;
create trigger set_therapist_service_mutation_requests_updated_at
before update on public.therapist_service_mutation_requests
for each row execute function public.set_updated_at();

create or replace function public.increment_therapist_service_version_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.therapy_id,
    new.title,
    new.description,
    new.duration_minutes,
    new.price_cents,
    new.currency,
    new.status,
    new.online_only,
    new.delivery_format,
    new.is_bookable,
    new.position,
    new.archived_at
  ) is distinct from row(
    old.therapy_id,
    old.title,
    old.description,
    old.duration_minutes,
    old.price_cents,
    old.currency,
    old.status,
    old.online_only,
    old.delivery_format,
    old.is_bookable,
    old.position,
    old.archived_at
  ) then
    new.version = old.version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists increment_therapist_service_version
on public.therapist_services;
create trigger increment_therapist_service_version
before update on public.therapist_services
for each row execute function public.increment_therapist_service_version_v1();

alter table public.therapist_service_mutation_requests enable row level security;
alter table public.therapist_service_events enable row level security;

grant select on public.therapist_service_events to authenticated, service_role;
grant all on public.therapist_service_mutation_requests to service_role;
grant all on public.therapist_service_events to service_role;
revoke insert, update, delete on public.therapies from anon, authenticated;
revoke insert, update, delete on public.therapy_categories from anon, authenticated;
revoke insert, update, delete on public.therapist_services from anon, authenticated;

drop policy if exists "Therapists can read own service events"
on public.therapist_service_events;
create policy "Therapists can read own service events"
on public.therapist_service_events
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "No direct service mutation request access"
on public.therapist_service_mutation_requests;
create policy "No direct service mutation request access"
on public.therapist_service_mutation_requests
for all
to authenticated
using (false)
with check (false);

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
  therapies.updated_at
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = therapies.id
where therapies.status = 'published'
  and therapies.is_available_for_services = true
  and therapy_categories.is_active = true;

grant select on public.therapist_service_allowed_catalog_v1
to authenticated, service_role;

create or replace view public.therapist_service_metrics_v1 as
select
  service.id as service_id,
  count(distinct favorite.id)::integer as favorite_count,
  count(distinct booking.id)::integer as booking_count,
  count(distinct booking.id) filter (
    where booking.created_at >= now() - interval '30 days'
  )::integer as bookings_last_30_days,
  null::numeric as booking_count_delta_percent
from public.therapist_services as service
left join public.favorite_therapists as favorite
  on favorite.therapist_profile_id = service.therapist_profile_id
left join public.bookings as booking
  on booking.service_id = service.id
group by service.id;

grant select on public.therapist_service_metrics_v1
to service_role;

create or replace view public.therapist_private_services_v1 as
select
  service.id as service_id,
  service.therapist_profile_id,
  service.therapy_id,
  therapy.name as therapy_name,
  therapy.slug as therapy_slug,
  therapy.status as therapy_status,
  therapy.is_public_visible as therapy_is_public_visible,
  therapy.is_available_for_services,
  category.id as category_id,
  category.name as category_name,
  category.slug as category_slug,
  service.status,
  service.title,
  service.description,
  service.duration_minutes,
  service.price_cents,
  service.currency,
  service.delivery_format,
  service.online_only,
  service.is_bookable,
  service.position,
  service.version,
  case
    when service.status <> 'active' then false
    when service.is_bookable = false then false
    when therapist.status <> 'approved' then false
    when therapist.is_public = false then false
    when therapist.is_accepting_bookings = false then false
    when therapy.status <> 'published' then false
    when therapy.is_public_visible = false then false
    when category.is_active = false then false
    else true
  end as is_reservable,
  case
    when service.status = 'paused' then 'service_paused'
    when service.status = 'archived' then 'service_archived'
    when service.status <> 'active' then 'service_not_active'
    when service.is_bookable = false then 'service_not_accepting_bookings'
    when therapist.status <> 'approved' then 'therapist_not_approved'
    when therapist.is_public = false then 'therapist_profile_private'
    when therapist.is_accepting_bookings = false then 'therapist_not_accepting_bookings'
    when therapy.status <> 'published' then 'therapy_not_published'
    when therapy.is_public_visible = false then 'therapy_not_public'
    when category.is_active = false then 'category_inactive'
    else null
  end as blocking_reason,
  coalesce(metrics.favorite_count, 0)::integer as favorite_count,
  coalesce(metrics.booking_count, 0)::integer as booking_count,
  coalesce(metrics.bookings_last_30_days, 0)::integer as bookings_last_30_days,
  metrics.booking_count_delta_percent,
  service.created_at,
  service.updated_at,
  service.archived_at
from public.therapist_services as service
join public.therapist_profiles as therapist
  on therapist.id = service.therapist_profile_id
join public.therapies as therapy
  on therapy.id = service.therapy_id
join public.therapy_categories as category
  on category.id = therapy.category_id
left join public.therapist_service_metrics_v1 as metrics
  on metrics.service_id = service.id;

grant select on public.therapist_private_services_v1
to service_role;

create or replace function public.get_therapist_for_service_actor_v1(
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
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  return v_therapist;
end;
$$;

create or replace function public.validate_platform_therapy_for_service_v1(
  p_therapy_id uuid
)
returns public.therapies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapy public.therapies%rowtype;
begin
  select therapy.*
    into v_therapy
  from public.therapies as therapy
  join public.therapy_categories as category
    on category.id = therapy.category_id
  where therapy.id = p_therapy_id
    and category.is_active = true;

  if not found then
    raise exception 'THERAPY_NOT_AVAILABLE_FOR_SERVICE' using errcode = 'P0002';
  end if;

  if v_therapy.status = 'archived' then
    raise exception 'THERAPY_ARCHIVED' using errcode = 'P0001';
  end if;

  if v_therapy.status <> 'published'
    or not v_therapy.is_available_for_services then
    raise exception 'THERAPY_NOT_AVAILABLE_FOR_SERVICE' using errcode = 'P0001';
  end if;

  return v_therapy;
end;
$$;

create or replace function public.therapist_service_limit_for_plan_v1(
  p_plan public.therapist_plan
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'free'::public.therapist_plan then 1
    when 'premium'::public.therapist_plan then 6
    else null::integer
  end;
$$;

create or replace function public.ensure_therapist_service_limit_v1(
  p_therapist_profile_id uuid,
  p_plan public.therapist_plan,
  p_excluding_service_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  v_limit := public.therapist_service_limit_for_plan_v1(p_plan);

  if v_limit is null then
    return;
  end if;

  select count(*)::integer
    into v_count
  from public.therapist_services as service
  where service.therapist_profile_id = p_therapist_profile_id
    and service.status <> 'archived'
    and (
      p_excluding_service_id is null
      or service.id <> p_excluding_service_id
    );

  if v_count >= v_limit then
    raise exception 'THERAPIST_SERVICE_PLAN_LIMIT_REACHED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.ensure_no_duplicate_therapist_service_v1(
  p_therapist_profile_id uuid,
  p_therapy_id uuid,
  p_excluding_service_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.therapist_services as service
    where service.therapist_profile_id = p_therapist_profile_id
      and service.therapy_id = p_therapy_id
      and service.status <> 'archived'
      and (
        p_excluding_service_id is null
        or service.id <> p_excluding_service_id
      )
  ) then
    raise exception 'THERAPIST_SERVICE_DUPLICATE_THERAPY' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.store_therapist_service_request_v1(
  p_therapist_profile_id uuid,
  p_request_id uuid,
  p_operation text,
  p_payload_hash text,
  p_service_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.therapist_service_mutation_requests%rowtype;
begin
  select *
    into v_existing
  from public.therapist_service_mutation_requests
  where therapist_profile_id = p_therapist_profile_id
    and request_id = p_request_id
  for update;

  if found then
    if v_existing.operation <> p_operation
      or v_existing.payload_hash <> p_payload_hash then
      raise exception 'THERAPIST_SERVICE_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;

    return jsonb_set(v_existing.response, '{idempotentReplay}', 'true'::jsonb, true);
  end if;

  insert into public.therapist_service_mutation_requests (
    therapist_profile_id,
    request_id,
    operation,
    payload_hash,
    service_id,
    response
  )
  values (
    p_therapist_profile_id,
    p_request_id,
    p_operation,
    p_payload_hash,
    p_service_id,
    p_response
  );

  return p_response;
end;
$$;

create or replace function public.get_therapist_service_request_replay_v1(
  p_therapist_profile_id uuid,
  p_request_id uuid,
  p_operation text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.therapist_service_mutation_requests%rowtype;
begin
  select *
    into v_existing
  from public.therapist_service_mutation_requests
  where therapist_profile_id = p_therapist_profile_id
    and request_id = p_request_id
  for update;

  if not found then
    return null;
  end if;

  if v_existing.operation <> p_operation
    or v_existing.payload_hash <> p_payload_hash then
    raise exception 'THERAPIST_SERVICE_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  return jsonb_set(v_existing.response, '{idempotentReplay}', 'true'::jsonb, true);
end;
$$;

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
begin
  select *
    into v_service
  from public.therapist_private_services_v1
  where service_id = p_service_id;

  if not found then
    return null;
  end if;

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
      'favoriteCount', v_service.favorite_count,
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
            'isVisibleInMatching', catalog.is_visible_in_matching
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
          jsonb_build_object(
            'serviceId', service.service_id,
            'therapyId', service.therapy_id,
            'therapy', jsonb_build_object(
              'id', service.therapy_id,
              'name', service.therapy_name,
              'slug', service.therapy_slug,
              'status', service.therapy_status,
              'isPubliclyVisible', service.therapy_is_public_visible,
              'isAvailableForServices', service.is_available_for_services
            ),
            'category', jsonb_build_object(
              'id', service.category_id,
              'name', service.category_name,
              'slug', service.category_slug
            ),
            'status', service.status,
            'title', service.title,
            'description', service.description,
            'durationMinutes', service.duration_minutes,
            'priceCents', service.price_cents,
            'currency', service.currency,
            'deliveryFormat', service.delivery_format,
            'onlineOnly', service.online_only,
            'isBookable', service.is_bookable,
            'position', service.position,
            'version', service.version,
            'isReservable', service.is_reservable,
            'blockingReason', service.blocking_reason,
            'metrics', jsonb_build_object(
              'favoriteCount', service.favorite_count,
              'bookingCount', service.booking_count,
              'bookingsLast30Days', service.bookings_last_30_days,
              'bookingCountDeltaPercent', service.booking_count_delta_percent
            ),
            'createdAt', service.created_at,
            'updatedAt', service.updated_at,
            'archivedAt', service.archived_at
          )
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

create or replace function public.create_therapist_service_v1(
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
  v_therapist public.therapist_profiles%rowtype;
  v_therapy public.therapies%rowtype;
  v_service public.therapist_services%rowtype;
  v_payload_hash text := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
  v_response jsonb;
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_description text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  v_delivery_format text := coalesce(p_payload ->> 'deliveryFormat', 'online');
  v_currency text := upper(coalesce(p_payload ->> 'currency', 'BRL'));
  v_duration integer := nullif(p_payload ->> 'durationMinutes', '')::integer;
  v_price integer := nullif(p_payload ->> 'priceCents', '')::integer;
  v_therapy_id uuid := nullif(p_payload ->> 'therapyId', '')::uuid;
  v_position integer;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  v_response := public.get_therapist_service_request_replay_v1(
    v_therapist.id,
    p_request_id,
    'create',
    v_payload_hash
  );

  if v_response is not null then
    return v_response;
  end if;

  v_therapy := public.validate_platform_therapy_for_service_v1(v_therapy_id);

  if v_title = '' or length(v_title) > 120 then
    raise exception 'THERAPIST_SERVICE_INVALID_TITLE' using errcode = 'P0001';
  end if;

  if v_description is not null and length(v_description) > 800 then
    raise exception 'THERAPIST_SERVICE_INVALID_DESCRIPTION' using errcode = 'P0001';
  end if;

  if v_duration is null or v_duration not between 15 and 240 then
    raise exception 'THERAPIST_SERVICE_INVALID_DURATION' using errcode = 'P0001';
  end if;

  if v_price is null or v_price not between 1000 and 2000000 then
    raise exception 'THERAPIST_SERVICE_INVALID_PRICE' using errcode = 'P0001';
  end if;

  if v_currency <> 'BRL' then
    raise exception 'THERAPIST_SERVICE_INVALID_CURRENCY' using errcode = 'P0001';
  end if;

  if v_delivery_format not in ('online', 'in_person', 'hybrid') then
    raise exception 'THERAPIST_SERVICE_INVALID_FORMAT' using errcode = 'P0001';
  end if;

  perform public.ensure_therapist_service_limit_v1(
    v_therapist.id,
    v_therapist.plan
  );
  perform public.ensure_no_duplicate_therapist_service_v1(
    v_therapist.id,
    v_therapy.id
  );

  select coalesce(max(position), 0) + 10
    into v_position
  from public.therapist_services
  where therapist_profile_id = v_therapist.id;

  insert into public.therapist_services (
    therapist_profile_id,
    therapy_id,
    title,
    description,
    duration_minutes,
    price_cents,
    currency,
    status,
    online_only,
    delivery_format,
    is_bookable,
    position
  )
  values (
    v_therapist.id,
    v_therapy.id,
    v_title,
    v_description,
    v_duration,
    v_price,
    v_currency,
    'draft',
    v_delivery_format = 'online',
    v_delivery_format,
    false,
    v_position
  )
  returning * into v_service;

  insert into public.therapist_service_booking_settings (
    service_id,
    buffer_before_minutes,
    buffer_after_minutes,
    min_notice_minutes,
    max_days_ahead,
    interval_minutes
  )
  values (v_service.id, 10, 10, 120, 30, 30)
  on conflict (service_id) do nothing;

  insert into public.therapist_service_events (
    therapist_profile_id,
    service_id,
    actor_user_id,
    event_type,
    request_id,
    next_status,
    resulting_version,
    metadata
  )
  values (
    v_therapist.id,
    v_service.id,
    p_actor_user_id,
    'service_created',
    p_request_id,
    v_service.status,
    v_service.version,
    jsonb_build_object('therapyId', v_service.therapy_id)
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'service', public.service_row_to_private_json_v1(v_service.id)
  );

  return public.store_therapist_service_request_v1(
    v_therapist.id,
    p_request_id,
    'create',
    v_payload_hash,
    v_service.id,
    v_response
  );
end;
$$;

create or replace function public.update_therapist_service_v1(
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
  v_therapist public.therapist_profiles%rowtype;
  v_service public.therapist_services%rowtype;
  v_next_therapy_id uuid := coalesce(nullif(p_payload ->> 'therapyId', '')::uuid, null);
  v_next_title text := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  v_next_description text := case
    when p_payload ? 'description'
      then nullif(btrim(coalesce(p_payload ->> 'description', '')), '')
    else null
  end;
  v_next_duration integer := nullif(p_payload ->> 'durationMinutes', '')::integer;
  v_next_price integer := nullif(p_payload ->> 'priceCents', '')::integer;
  v_next_currency text := case
    when p_payload ? 'currency' then upper(p_payload ->> 'currency')
    else null
  end;
  v_next_format text := p_payload ->> 'deliveryFormat';
  v_next_bookable boolean := case
    when p_payload ? 'isBookable' then (p_payload ->> 'isBookable')::boolean
    else null
  end;
  v_payload_hash text := encode(
    extensions.digest(
      jsonb_build_object(
        'serviceId', p_service_id,
        'expectedVersion', p_expected_version,
        'payload', p_payload
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_response jsonb;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  v_response := public.get_therapist_service_request_replay_v1(
    v_therapist.id,
    p_request_id,
    'update',
    v_payload_hash
  );

  if v_response is not null then
    return v_response;
  end if;

  select *
    into v_service
  from public.therapist_services
  where id = p_service_id
    and therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'THERAPIST_SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_service.version <> p_expected_version then
    raise exception 'THERAPIST_SERVICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  if v_next_therapy_id is not null and v_next_therapy_id <> v_service.therapy_id then
    perform public.validate_platform_therapy_for_service_v1(v_next_therapy_id);

    if exists (
      select 1 from public.bookings where service_id = v_service.id
    ) then
      raise exception 'THERAPIST_SERVICE_THERAPY_LOCKED' using errcode = 'P0001';
    end if;

    perform public.ensure_no_duplicate_therapist_service_v1(
      v_therapist.id,
      v_next_therapy_id,
      v_service.id
    );
  end if;

  update public.therapist_services
  set
    therapy_id = coalesce(v_next_therapy_id, therapy_id),
    title = coalesce(v_next_title, title),
    description = case
      when p_payload ? 'description' then v_next_description
      else description
    end,
    duration_minutes = coalesce(v_next_duration, duration_minutes),
    price_cents = coalesce(v_next_price, price_cents),
    currency = coalesce(v_next_currency, currency),
    delivery_format = coalesce(v_next_format, delivery_format),
    online_only = coalesce(v_next_format, delivery_format) = 'online',
    is_bookable = coalesce(v_next_bookable, is_bookable),
    updated_at = now()
  where id = v_service.id
  returning * into v_service;

  insert into public.therapist_service_events (
    therapist_profile_id,
    service_id,
    actor_user_id,
    event_type,
    request_id,
    previous_status,
    next_status,
    previous_version,
    resulting_version
  )
  values (
    v_therapist.id,
    v_service.id,
    p_actor_user_id,
    'service_updated',
    p_request_id,
    v_service.status,
    v_service.status,
    p_expected_version,
    v_service.version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'service', public.service_row_to_private_json_v1(v_service.id)
  );

  return public.store_therapist_service_request_v1(
    v_therapist.id,
    p_request_id,
    'update',
    v_payload_hash,
    v_service.id,
    v_response
  );
end;
$$;

create or replace function public.transition_therapist_service_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_service_id uuid,
  p_expected_version bigint,
  p_action text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_service public.therapist_services%rowtype;
  v_previous_status public.service_status;
  v_next_status public.service_status;
  v_event_type text;
  v_payload_hash text := encode(
    extensions.digest(
      jsonb_build_object(
        'serviceId', p_service_id,
        'expectedVersion', p_expected_version,
        'action', p_action
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_response jsonb;
begin
  if p_action not in ('activate', 'pause', 'archive') then
    raise exception 'THERAPIST_SERVICE_INVALID_ACTION' using errcode = 'P0001';
  end if;

  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  v_response := public.get_therapist_service_request_replay_v1(
    v_therapist.id,
    p_request_id,
    p_action,
    v_payload_hash
  );

  if v_response is not null then
    return v_response;
  end if;

  select *
    into v_service
  from public.therapist_services
  where id = p_service_id
    and therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'THERAPIST_SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_service.version <> p_expected_version then
    raise exception 'THERAPIST_SERVICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  v_previous_status := v_service.status;

  if p_action = 'activate' then
    perform public.validate_platform_therapy_for_service_v1(v_service.therapy_id);
    perform public.ensure_therapist_service_limit_v1(
      v_therapist.id,
      v_therapist.plan,
      v_service.id
    );
    perform public.ensure_no_duplicate_therapist_service_v1(
      v_therapist.id,
      v_service.therapy_id,
      v_service.id
    );
    v_next_status := 'active';
    v_event_type := 'service_activated';
  elsif p_action = 'pause' then
    v_next_status := 'paused';
    v_event_type := 'service_paused';
  else
    v_next_status := 'archived';
    v_event_type := 'service_archived';
  end if;

  update public.therapist_services
  set
    status = v_next_status,
    is_bookable = p_action = 'activate',
    archived_at = case when p_action = 'archive' then now() else archived_at end,
    updated_at = now()
  where id = v_service.id
  returning * into v_service;

  insert into public.therapist_service_events (
    therapist_profile_id,
    service_id,
    actor_user_id,
    event_type,
    request_id,
    previous_status,
    next_status,
    previous_version,
    resulting_version
  )
  values (
    v_therapist.id,
    v_service.id,
    p_actor_user_id,
    v_event_type,
    p_request_id,
    v_previous_status,
    v_service.status,
    p_expected_version,
    v_service.version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'service', public.service_row_to_private_json_v1(v_service.id)
  );

  return public.store_therapist_service_request_v1(
    v_therapist.id,
    p_request_id,
    p_action,
    v_payload_hash,
    v_service.id,
    v_response
  );
end;
$$;

create or replace function public.reorder_therapist_services_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_service_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_payload_hash text := encode(
    extensions.digest(array_to_string(p_service_ids, ',')::text, 'sha256'),
    'hex'
  );
  v_service_id uuid;
  v_position integer := 0;
  v_response jsonb;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  v_response := public.get_therapist_service_request_replay_v1(
    v_therapist.id,
    p_request_id,
    'reorder',
    v_payload_hash
  );

  if v_response is not null then
    return v_response;
  end if;

  if coalesce(array_length(p_service_ids, 1), 0) = 0
    or array_length(p_service_ids, 1) > 100 then
    raise exception 'THERAPIST_SERVICE_INVALID_ORDER' using errcode = 'P0001';
  end if;

  if (
    select count(distinct item)
    from unnest(p_service_ids) as item
  ) <> array_length(p_service_ids, 1) then
    raise exception 'THERAPIST_SERVICE_INVALID_ORDER' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(p_service_ids) as item
    left join public.therapist_services as service
      on service.id = item
      and service.therapist_profile_id = v_therapist.id
    where service.id is null
  ) then
    raise exception 'THERAPIST_SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  foreach v_service_id in array p_service_ids loop
    v_position := v_position + 10;

    update public.therapist_services
    set position = v_position,
        updated_at = now()
    where id = v_service_id;
  end loop;

  insert into public.therapist_service_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    metadata
  )
  values (
    v_therapist.id,
    p_actor_user_id,
    'services_reordered',
    p_request_id,
    jsonb_build_object('serviceIds', to_jsonb(p_service_ids))
  );

  v_response := public.list_private_therapist_services_v1(p_actor_user_id)
    || jsonb_build_object('idempotentReplay', false);

  return public.store_therapist_service_request_v1(
    v_therapist.id,
    p_request_id,
    'reorder',
    v_payload_hash,
    null,
    v_response
  );
end;
$$;

revoke all on function public.increment_therapist_service_version_v1() from public;
revoke all on function public.get_therapist_for_service_actor_v1(uuid) from public;
revoke all on function public.validate_platform_therapy_for_service_v1(uuid) from public;
revoke all on function public.therapist_service_limit_for_plan_v1(public.therapist_plan) from public;
revoke all on function public.ensure_therapist_service_limit_v1(uuid, public.therapist_plan, uuid) from public;
revoke all on function public.ensure_no_duplicate_therapist_service_v1(uuid, uuid, uuid) from public;
revoke all on function public.store_therapist_service_request_v1(uuid, uuid, text, text, uuid, jsonb) from public;
revoke all on function public.get_therapist_service_request_replay_v1(uuid, uuid, text, text) from public;
revoke all on function public.service_row_to_private_json_v1(uuid) from public;
revoke all on function public.list_therapist_service_catalog_v1(uuid) from public;
revoke all on function public.list_private_therapist_services_v1(uuid) from public;
revoke all on function public.create_therapist_service_v1(uuid, uuid, jsonb) from public;
revoke all on function public.update_therapist_service_v1(uuid, uuid, uuid, bigint, jsonb) from public;
revoke all on function public.transition_therapist_service_v1(uuid, uuid, uuid, bigint, text) from public;
revoke all on function public.reorder_therapist_services_v1(uuid, uuid, uuid[]) from public;

grant execute on function public.list_therapist_service_catalog_v1(uuid)
  to service_role;
grant execute on function public.list_private_therapist_services_v1(uuid)
  to service_role;
grant execute on function public.create_therapist_service_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.update_therapist_service_v1(uuid, uuid, uuid, bigint, jsonb)
  to service_role;
grant execute on function public.transition_therapist_service_v1(uuid, uuid, uuid, bigint, text)
  to service_role;
grant execute on function public.reorder_therapist_services_v1(uuid, uuid, uuid[])
  to service_role;

comment on column public.therapies.is_available_for_services is
  'Controls whether therapists may create new services for this platform therapy. It is independent from public visibility and Match.';
comment on column public.therapist_services.therapy_id is
  'Canonical relationship to the platform therapy catalog. Therapist services never relate by free-text therapy name.';
comment on column public.therapist_services.price_cents is
  'Integer amount in cents. No decimal money is accepted by service mutations.';
comment on column public.therapist_services.duration_minutes is
  'Session duration in minutes; supported range for therapist services is 15 to 240.';
comment on table public.therapist_service_mutation_requests is
  'Idempotency ledger for authenticated therapist service mutations executed by Edge Functions.';
comment on table public.therapist_service_events is
  'Sanitized audit trail for therapist service lifecycle changes.';
comment on view public.therapist_service_allowed_catalog_v1 is
  'Private-safe catalog of platform therapies a therapist may use when creating services.';
comment on view public.therapist_private_services_v1 is
  'Private therapist shell projection for services, canonical therapy/category data and aggregate metrics.';

create or replace view public.public_therapies_v as
with therapist_counts as (
  select
    therapist_services.therapy_id,
    count(distinct therapist_profiles.id)::integer as therapist_count
  from public.therapist_services
  join public.therapist_profiles
    on therapist_profiles.id = therapist_services.therapist_profile_id
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  where therapist_profiles.status = 'approved'
    and therapist_profiles.is_public = true
    and therapist_profiles.is_accepting_bookings = true
    and therapist_services.status = 'active'
    and therapist_services.is_bookable = true
    and therapist_services.online_only = true
    and therapies.status = 'published'
    and therapies.is_public_visible = true
  group by therapist_services.therapy_id
)
select
  therapies.id,
  therapies.slug,
  therapies.name,
  therapies.short_description,
  therapies.description,
  therapies.image_url,
  therapies.status,
  therapies.published_at,
  therapies.popularity_score,
  therapies.created_at,
  therapies.updated_at,
  therapy_categories.id as category_id,
  therapy_categories.slug as category_slug,
  therapy_categories.name as category_name,
  therapy_categories.sort_order as category_sort_order,
  coalesce(therapist_counts.therapist_count, 0)::integer as therapist_count,
  (therapies.popularity_score >= 80 or therapies.is_featured = true) as is_popular,
  (
    therapies.published_at is not null
    and therapies.published_at >= now() - interval '45 days'
  ) as is_new,
  lower(
    public.unaccent(
      concat_ws(
        ' ',
        therapies.name,
        therapies.short_description,
        therapies.description,
        therapy_categories.name,
        array_to_string(therapies.search_aliases, ' ')
      )
    )
  ) as search_text,
  therapies.is_featured
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join therapist_counts
  on therapist_counts.therapy_id = therapies.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and therapy_categories.is_active = true;

create or replace view public.public_home_therapies as
select
  public_therapies_v.id,
  public_therapies_v.name,
  public_therapies_v.slug,
  public_therapies_v.slug as href_slug,
  public_therapies_v.short_description,
  public_therapies_v.is_featured,
  public_therapies_v.category_name,
  public_therapies_v.category_slug,
  public_therapies_v.updated_at
from public.public_therapies_v;

create or replace view public.public_therapist_profile_services_v as
select
  therapist_profiles.slug as therapist_slug,
  therapist_services.id as service_id,
  therapist_services.title as service_title,
  therapist_services.description,
  therapist_services.duration_minutes,
  therapist_services.price_cents,
  therapist_services.currency,
  therapies.name as therapy_name,
  therapies.slug as therapy_slug,
  row_number() over (
    partition by therapist_profiles.id
    order by therapist_services.price_cents asc, therapist_services.title asc
  ) as sort_order,
  coalesce(settings.buffer_before_minutes, 10) as buffer_before_minutes,
  coalesce(settings.buffer_after_minutes, 10) as buffer_after_minutes,
  coalesce(settings.min_notice_minutes, 120) as min_notice_minutes,
  coalesce(settings.max_days_ahead, 30) as max_days_ahead,
  coalesce(settings.interval_minutes, 30) as interval_minutes,
  coalesce(rules.items, '[]'::jsonb) as availability_rules,
  coalesce(exceptions.items, '[]'::jsonb) as availability_exceptions,
  coalesce(conflicts.items, '[]'::jsonb) as booking_conflicts
from public.therapist_profiles
join public.therapist_services
  on therapist_services.therapist_profile_id = therapist_profiles.id
join public.therapies
  on therapies.id = therapist_services.therapy_id
left join public.therapist_service_booking_settings as settings
  on settings.service_id = therapist_services.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', availability_rules.day_of_week,
      'endTime', availability_rules.end_time::text,
      'isActive', availability_rules.is_active,
      'serviceId', availability_rules.service_id,
      'startTime', availability_rules.start_time::text,
      'timezone', availability_rules.timezone
    )
    order by availability_rules.day_of_week asc, availability_rules.start_time asc
  ) as items
  from public.availability_rules
  where availability_rules.therapist_profile_id = therapist_profiles.id
    and (
      availability_rules.service_id is null
      or availability_rules.service_id = therapist_services.id
    )
    and availability_rules.is_active = true
) as rules on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'endsAt', availability_exceptions.ends_at,
      'isAvailable', availability_exceptions.is_available,
      'serviceId', availability_exceptions.service_id,
      'startsAt', availability_exceptions.starts_at
    )
  ) as items
  from public.availability_exceptions
  where availability_exceptions.therapist_profile_id = therapist_profiles.id
    and (
      availability_exceptions.service_id is null
      or availability_exceptions.service_id = therapist_services.id
    )
    and availability_exceptions.ends_at >= now()
) as exceptions on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'endsAt', bookings.ends_at,
      'serviceId', bookings.service_id,
      'startsAt', bookings.starts_at,
      'status', bookings.status
    )
  ) as items
  from public.bookings
  where bookings.therapist_profile_id = therapist_profiles.id
    and bookings.service_id = therapist_services.id
    and bookings.ends_at >= now()
    and bookings.status in ('pending_payment', 'confirmed', 'completed')
) as conflicts on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true
  and therapist_services.status = 'active'
  and therapist_services.is_bookable = true
  and therapist_services.online_only = true
  and therapies.status = 'published'
  and therapies.is_public_visible = true;

create or replace view public.public_therapist_profiles_v as
select
  therapist_profiles.id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.plan,
  therapist_profiles.bio,
  therapist_profiles.photo_url,
  therapist_profiles.city,
  therapist_profiles.state,
  therapist_profiles.is_accepting_bookings,
  therapist_profiles.accepts_online_sessions,
  true as is_verified,
  coalesce(content.short_intro, therapist_profiles.headline) as short_intro,
  coalesce(content.short_intro, therapist_profiles.headline) as published_headline,
  coalesce(tags.tags, array[]::text[]) as tags,
  coalesce(
    content.video_url,
    therapist_profiles.metadata ->> 'video_url'
  ) as video_url,
  coalesce(content.video_provider, 'external') as video_provider,
  coalesce(
    content.video_thumbnail_url,
    '/home/tablet-video-session.png'
  ) as video_thumbnail_url,
  coalesce(content.video_title, 'Um convite para você') as video_title,
  case
    when therapist_profiles.plan = 'premium_plus'
      then array['Perfil verificado', 'Terapeuta Plus']::text[]
    else array['Perfil verificado']::text[]
  end as badges,
  reviews.average_rating,
  reviews.review_count,
  coalesce(sessions.sessions_completed, 0)::integer as sessions_completed,
  therapist_profiles.updated_at
from public.therapist_profiles
left join lateral (
  select *
  from public.therapist_profile_content_versions
  where therapist_profile_content_versions.therapist_profile_id =
    therapist_profiles.id
    and therapist_profile_content_versions.status = 'published'
  order by
    therapist_profile_content_versions.published_at desc nulls last,
    therapist_profile_content_versions.created_at desc
  limit 1
) as content on true
left join lateral (
  select coalesce(
    array_agg(tag.value order by tag.value),
    array[]::text[]
  ) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(
        therapist_profiles.metadata -> 'care_tags'
      ) = 'array'
        then therapist_profiles.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) as tag(value)
) as tags on true
left join lateral (
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.reviews as review
  join public.bookings as booking
    on booking.id = review.booking_id
  join public.session_payments as payment
    on payment.booking_id = booking.id
  where review.therapist_profile_id = therapist_profiles.id
    and review.status = 'published'
    and booking.status = 'completed'
    and payment.financial_status = 'paid'
) as reviews on true
left join lateral (
  select count(*) as sessions_completed
  from public.bookings as booking
  join public.session_payments as payment
    on payment.booking_id = booking.id
  where booking.therapist_profile_id = therapist_profiles.id
    and booking.status = 'completed'
    and payment.financial_status = 'paid'
) as sessions on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and exists (
    select 1
    from public.therapist_services
    join public.therapies
      on therapies.id = therapist_services.therapy_id
    where therapist_services.therapist_profile_id = therapist_profiles.id
      and therapist_services.status = 'active'
      and therapist_services.is_bookable = true
      and therapist_services.online_only = true
      and therapies.status = 'published'
      and therapies.is_public_visible = true
  );

grant select on public.public_therapies_v to anon, authenticated, service_role;
grant select on public.public_home_therapies to anon, authenticated, service_role;
grant select on public.public_therapist_profiles_v to anon, authenticated, service_role;
grant select on public.public_therapist_profile_services_v to anon, authenticated, service_role;

drop view if exists public.public_therapist_search;
create view public.public_therapist_search as
select
  therapist_profiles.id as therapist_profile_id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.headline as therapist_headline,
  therapist_profiles.bio as therapist_bio,
  therapist_profiles.photo_url,
  therapist_profiles.city,
  therapist_profiles.state,
  service_summary.service_id,
  service_summary.service_title,
  service_summary.service_description,
  service_summary.service_price_cents,
  service_summary.duration_minutes,
  service_summary.therapy_id,
  service_summary.therapy_name,
  service_summary.therapy_slug,
  theme_summary.theme_names,
  theme_summary.theme_slugs,
  coalesce(
    care_tags.tags,
    theme_summary.theme_names,
    array[service_summary.therapy_name]
  ) as tags,
  next_slot.next_slot_at,
  coalesce(review_summary.average_rating, 0) as average_rating,
  coalesce(review_summary.review_count, 0)::integer as review_count,
  coalesce(session_summary.completed_session_count, 0)::integer as completed_session_count,
  review_quote.review_quote,
  coalesce((therapist_profiles.metadata ->> 'has_intro_video')::boolean, false) as has_video,
  coalesce(
    therapist_profiles.metadata ->> 'highlight',
    case
      when therapist_profiles.plan in ('premium', 'premium_plus') then 'Destaque TES'
      else 'Perfil Verificado'
    end
  ) as highlight,
  case
    when therapist_profiles.metadata ->> 'highlight_tone' in ('featured', 'verified')
      then therapist_profiles.metadata ->> 'highlight_tone'
    when therapist_profiles.plan in ('premium', 'premium_plus') then 'featured'
    else 'verified'
  end as highlight_tone,
  concat_ws(
    ' ',
    therapist_profiles.public_name,
    therapist_profiles.headline,
    therapist_profiles.bio,
    therapist_profiles.city,
    therapist_profiles.state,
    service_summary.service_title,
    service_summary.service_description,
    service_summary.therapy_name,
    array_to_string(theme_summary.theme_names, ' '),
    array_to_string(care_tags.tags, ' ')
  ) as search_text,
  therapist_profiles.updated_at
from public.therapist_profiles
join lateral (
  select
    therapist_services.id as service_id,
    therapist_services.title as service_title,
    therapist_services.description as service_description,
    therapist_services.price_cents as service_price_cents,
    therapist_services.duration_minutes,
    therapies.id as therapy_id,
    therapies.name as therapy_name,
    therapies.slug as therapy_slug
  from public.therapist_services
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  join public.therapy_categories
    on therapy_categories.id = therapies.category_id
  where therapist_services.therapist_profile_id = therapist_profiles.id
    and therapist_services.status = 'active'
    and therapist_services.is_bookable = true
    and therapist_services.online_only = true
    and therapies.status = 'published'
    and therapies.is_public_visible = true
    and therapy_categories.is_active = true
  order by therapist_services.price_cents asc, therapist_services.title asc
  limit 1
) as service_summary on true
left join lateral (
  select
    array_agg(distinct therapy_themes.name order by therapy_themes.name) as theme_names,
    array_agg(distinct therapy_themes.slug order by therapy_themes.slug) as theme_slugs
  from public.therapy_theme_weights
  join public.therapy_themes
    on therapy_themes.id = coalesce(
      therapy_theme_weights.theme_id,
      therapy_theme_weights.subtheme_id
    )
  where therapy_theme_weights.therapy_id = service_summary.therapy_id
    and therapy_theme_weights.is_active = true
    and therapy_themes.is_active = true
) as theme_summary on true
left join lateral (
  select array_agg(tag.value order by tag.value) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist_profiles.metadata -> 'care_tags') = 'array'
        then therapist_profiles.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) as tag(value)
) as care_tags on true
left join lateral (
  select
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*) as review_count
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as review_summary on true
left join lateral (
  select count(*) as completed_session_count
  from public.bookings
  where bookings.therapist_profile_id = therapist_profiles.id
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as session_summary on true
left join lateral (
  select reviews.comment as review_quote
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
    and reviews.comment is not null
    and length(trim(reviews.comment)) >= 12
  order by reviews.published_at desc nulls last, reviews.created_at desc
  limit 1
) as review_quote on true
left join lateral (
  select
    ((timezone(next_rule.timezone, now())::date + next_rule.days_ahead) + next_rule.start_time) at time zone next_rule.timezone as next_slot_at
  from (
    select
      availability_rules.start_time,
      availability_rules.timezone,
      case
        when raw_rule.raw_days_ahead = 0
          and availability_rules.start_time <= timezone(availability_rules.timezone, now())::time
          then 7
        else raw_rule.raw_days_ahead
      end as days_ahead
    from public.availability_rules
    cross join lateral (
      select ((availability_rules.day_of_week - extract(dow from timezone(availability_rules.timezone, now()))::integer + 7) % 7)::integer as raw_days_ahead
    ) as raw_rule
    where availability_rules.therapist_profile_id = therapist_profiles.id
      and (
        availability_rules.service_id is null
        or availability_rules.service_id = service_summary.service_id
      )
      and availability_rules.is_active = true
    order by days_ahead asc, availability_rules.start_time asc
    limit 1
  ) as next_rule
) as next_slot on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true;

grant select on public.public_therapist_search to anon, authenticated, service_role;

comment on view public.public_therapies_v is
  'Safe public projection for catalog surfaces. Exposes only published, public therapies linked to active categories; therapist counts use active bookable services.';
comment on view public.public_therapist_profiles_v is
  'Safe public therapist projection. Paid/completed aggregates use canonical session_payments; profile eligibility requires an active bookable service.';
comment on view public.public_therapist_profile_services_v is
  'Safe public projection for public therapist services and derived availability inputs for published active bookable services.';
comment on view public.public_therapist_search is
  'Safe public projection for therapist search. The selected service is active, online and bookable, and ratings remain based on paid completed bookings.';
