create table if not exists public.therapy_public_content (
  therapy_id uuid primary key references public.therapies (id) on delete cascade,
  hero_image_url text,
  subtitle text,
  introduction text,
  complementary_description text,
  safety_note text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapy_highlights (
  id uuid primary key default gen_random_uuid(),
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  title text not null,
  icon_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapy_highlights_unique_sort unique (therapy_id, sort_order)
);

create table if not exists public.therapy_benefits (
  id uuid primary key default gen_random_uuid(),
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  title text not null,
  description text,
  icon_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapy_benefits_unique_sort unique (therapy_id, sort_order)
);

create index if not exists therapy_highlights_therapy_sort_idx
  on public.therapy_highlights (therapy_id, sort_order);

create index if not exists therapy_benefits_therapy_sort_idx
  on public.therapy_benefits (therapy_id, sort_order);

drop trigger if exists set_therapy_public_content_updated_at on public.therapy_public_content;
create trigger set_therapy_public_content_updated_at
before update on public.therapy_public_content
for each row execute function public.set_updated_at();

drop trigger if exists set_therapy_highlights_updated_at on public.therapy_highlights;
create trigger set_therapy_highlights_updated_at
before update on public.therapy_highlights
for each row execute function public.set_updated_at();

drop trigger if exists set_therapy_benefits_updated_at on public.therapy_benefits;
create trigger set_therapy_benefits_updated_at
before update on public.therapy_benefits
for each row execute function public.set_updated_at();

create or replace view public.public_therapy_details_v as
select
  public_therapies_v.id,
  public_therapies_v.slug,
  public_therapies_v.name,
  public_therapies_v.short_description,
  public_therapies_v.description,
  coalesce(
    therapy_public_content.hero_image_url,
    public_therapies_v.image_url
  ) as hero_image_url,
  public_therapies_v.image_url,
  public_therapies_v.therapist_count,
  public_therapies_v.category_slug,
  public_therapies_v.category_name,
  therapy_public_content.subtitle,
  therapy_public_content.introduction,
  therapy_public_content.complementary_description,
  coalesce(
    therapy_public_content.safety_note,
    therapies.safety_note
  ) as safety_note,
  therapy_public_content.seo_title,
  therapy_public_content.seo_description,
  coalesce(highlights.items, '[]'::jsonb) as highlights,
  coalesce(benefits.items, '[]'::jsonb) as benefits,
  public_therapies_v.published_at,
  public_therapies_v.updated_at
from public.public_therapies_v
join public.therapies
  on therapies.id = public_therapies_v.id
left join public.therapy_public_content
  on therapy_public_content.therapy_id = public_therapies_v.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'title', therapy_highlights.title,
      'iconKey', therapy_highlights.icon_key
    )
    order by therapy_highlights.sort_order asc
  ) as items
  from public.therapy_highlights
  where therapy_highlights.therapy_id = public_therapies_v.id
) as highlights on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'title', therapy_benefits.title,
      'description', therapy_benefits.description,
      'iconKey', therapy_benefits.icon_key
    )
    order by therapy_benefits.sort_order asc
  ) as items
  from public.therapy_benefits
  where therapy_benefits.therapy_id = public_therapies_v.id
) as benefits on true;

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
  coalesce(care_tags.tags, theme_summary.theme_names, array[service_summary.therapy_name]) as tags,
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

grant select on public.public_therapy_details_v to anon, authenticated, service_role;
grant select on public.public_therapist_search to anon, authenticated, service_role;

comment on table public.therapy_public_content is
  'Published editorial content for public therapy detail pages. Operational data such as price, availability and matching weights stays outside this table.';
comment on table public.therapy_highlights is
  'Short public highlights displayed in the hero of a public therapy detail page.';
comment on table public.therapy_benefits is
  'Public benefit cards for therapy detail pages, written without promises of cure, diagnosis or guaranteed outcomes.';
comment on view public.public_therapy_details_v is
  'Safe public projection for /terapias/:slug. Returns only published public therapies with active categories plus editorial content.';
comment on view public.public_therapist_search is
  'Safe public projection for therapist search and therapy detail related professionals. Ratings and session counts use paid completed bookings only.';
