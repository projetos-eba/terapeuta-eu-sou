-- The Match detail must consider every eligible service for the chosen therapy.
-- public_therapist_search intentionally exposes one summary service per profile,
-- which is appropriate for directory cards but excluded therapists when the
-- chosen therapy was not their first/least expensive service.

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
  select therapy.id
    into v_therapy_id
  from public.therapies therapy
  join public.therapy_categories category
    on category.id = therapy.category_id
  where therapy.slug = p_therapy_slug
    and therapy.status = 'published'
    and therapy.is_public_visible = true
    and category.is_active = true;

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
  from public.matching_interests interest
  where interest.id = any(coalesce(p_interest_ids, '{}'::uuid[]))
    and interest.theme_id = any(v_relevant_theme_ids)
    and interest.is_active = true;

  return coalesce((
    with eligible_services as (
      select
        profile.id as therapist_profile_id,
        profile.slug,
        profile.public_name,
        profile.headline as therapist_headline,
        profile.photo_url,
        profile.plan,
        service.id as service_id,
        service.title as service_title,
        service.description as service_description,
        service.position,
        service.price_cents,
        coalesce(tags.tags, array[therapy.name]) as tags,
        coalesce(interest_matches.matching_interest_count, 0)::integer as matching_interest_count,
        coalesce(theme_matches.matching_service_theme_count, 0)::integer as matching_service_theme_count,
        review_summary.average_rating,
        coalesce(review_summary.review_count, 0)::integer as review_count,
        next_slot.next_slot_at
      from public.therapist_services service
      join public.therapist_profiles profile
        on profile.id = service.therapist_profile_id
      join public.therapies therapy
        on therapy.id = service.therapy_id
      join public.therapy_categories category
        on category.id = therapy.category_id
      left join lateral (
        select array_agg(tag.value order by tag.value) as tags
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(profile.metadata -> 'care_tags') = 'array'
              then profile.metadata -> 'care_tags'
            else '[]'::jsonb
          end
        ) as tag(value)
      ) tags on true
      left join lateral (
        select count(distinct service_interest.interest_id)::integer as matching_interest_count
        from public.therapist_service_matching_interests service_interest
        where service_interest.therapist_service_id = service.id
          and service_interest.interest_id = any(v_relevant_interest_ids)
      ) interest_matches on true
      left join lateral (
        select count(distinct service_theme.theme_id)::integer as matching_service_theme_count
        from public.therapist_service_matching_themes service_theme
        where service_theme.therapist_service_id = service.id
          and service_theme.theme_id = any(v_relevant_theme_ids)
      ) theme_matches on true
      left join lateral (
        select
          round(avg(review.rating)::numeric, 1) as average_rating,
          count(*)::integer as review_count
        from public.public_therapist_profile_reviews_v_internal review
        where review.therapist_slug = profile.slug
      ) review_summary on true
      left join lateral (
        select min((slot.value ->> 'startsAt')::timestamptz) as next_slot_at
        from jsonb_array_elements(
          coalesce(
            public.get_service_available_slots_v1(
              service.id,
              now(),
              now() + interval '31 days',
              1
            ) -> 'slots',
            '[]'::jsonb
          )
        ) slot(value)
      ) next_slot on true
      where service.therapy_id = v_therapy_id
        and service.archived_at is null
        and service.status = 'active'
        and service.is_bookable
        and service.online_only
        and therapy.status = 'published'
        and therapy.is_public_visible
        and category.is_active
        and public.is_public_service_booking_eligible_v1(service.id)
        and public.is_therapist_publication_eligible_v1(profile.id)
    ), selected_service as (
      select
        eligible_services.*,
        row_number() over (
          partition by therapist_profile_id
          order by
            matching_interest_count desc,
            matching_service_theme_count desc,
            position asc nulls last,
            price_cents asc,
            service_title asc,
            service_id asc
        ) as service_rank
      from eligible_services
    ), ranked as (
      select *
      from selected_service
      where service_rank = 1
      order by
        case
          when cardinality(v_relevant_interest_ids) > 0
            then matching_interest_count
          else 0
        end desc,
        matching_service_theme_count desc,
        case
          when cardinality(v_relevant_theme_ids) > 0 then
            case plan
              when 'premium_plus' then 2
              when 'premium' then 1
              else 0
            end
          else 0
        end desc,
        next_slot_at asc nulls last,
        average_rating desc nulls last,
        review_count desc,
        slug asc
      limit least(greatest(coalesce(p_limit, 6), 1), 24)
    )
    select jsonb_agg(
      jsonb_build_object(
        'slug', slug,
        'public_name', public_name,
        'photo_url', photo_url,
        'therapist_headline', therapist_headline,
        'service_description', service_description,
        'tags', tags,
        'average_rating', average_rating,
        'review_count', review_count,
        'completed_session_count', 0,
        'next_slot_at', next_slot_at,
        'service_id', service_id,
        'matching_interest_count', matching_interest_count,
        'matching_service_theme_count', matching_service_theme_count
      )
      order by
        case
          when cardinality(v_relevant_interest_ids) > 0
            then matching_interest_count
          else 0
        end desc,
        matching_service_theme_count desc,
        case
          when cardinality(v_relevant_theme_ids) > 0 then
            case plan
              when 'premium_plus' then 2
              when 'premium' then 1
              else 0
            end
          else 0
        end desc,
        next_slot_at asc nulls last,
        average_rating desc nulls last,
        review_count desc,
        slug asc
    )
    from ranked
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)
  from public;
grant execute on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)
  to anon, authenticated, service_role;

-- Match result counts must use exactly the same public-service eligibility as
-- the related-professionals RPC above, including therapists whose chosen
-- therapy is an additional service.
create or replace view public.public_matching_therapist_counts as
select
  therapy.id as therapy_id,
  count(distinct service.therapist_profile_id)::integer as therapist_count
from public.therapies therapy
join public.matching_therapy_settings matching_settings
  on matching_settings.therapy_id = therapy.id
  and matching_settings.is_visible_in_matching = true
left join public.therapist_services service
  on service.therapy_id = therapy.id
  and service.archived_at is null
  and service.status = 'active'
  and service.is_bookable
  and service.online_only
  and public.is_public_service_booking_eligible_v1(service.id)
where therapy.status = 'published'
  and therapy.is_public_visible = true
  and exists (
    select 1
    from public.therapy_categories category
    where category.id = therapy.category_id
      and category.is_active = true
  )
group by therapy.id;

alter view public.public_matching_therapist_counts
  set (security_invoker = true);

revoke all on public.public_matching_therapist_counts
  from public, anon, authenticated, service_role;
grant select on public.public_matching_therapist_counts
  to anon, authenticated, service_role;

comment on view public.public_matching_therapist_counts is
  'Public Match therapist-count projection. Counts distinct therapists with an active, online, bookable and publication-eligible service for each visible Match therapy.';
