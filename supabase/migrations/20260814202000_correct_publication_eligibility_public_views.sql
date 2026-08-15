-- Keep the two public projections that intentionally run as SECURITY INVOKER
-- directly over their RLS-protected tables.  The eligibility predicate remains
-- the single publication gate; no private implementation view is exposed.

create or replace function public.get_therapist_publication_eligibility_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select * from public.therapist_profiles where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (where s.status = 'active' and s.is_bookable and s.online_only)::integer as online_bookable,
      count(*) filter (
        where s.status = 'active' and s.is_bookable and s.online_only
          and t.status = 'published' and t.is_public_visible
      )::integer as published_therapy,
      count(*) filter (
        where s.status = 'active' and s.is_bookable and s.online_only
          and t.status = 'published' and t.is_public_visible and c.is_active
      )::integer as eligible
    from public.therapist_services s
    join public.therapies t on t.id = s.therapy_id
    join public.therapy_categories c on c.id = t.category_id
    where s.therapist_profile_id = p_therapist_profile_id
      and s.archived_at is null
  )
  select jsonb_build_object(
    'eligible', coalesce(
      p.status = 'approved'::public.therapist_status
      and p.is_public and p.is_accepting_bookings and p.accepts_online_sessions
      and coalesce(s.eligible, 0) > 0,
      false
    ),
    'blockers', coalesce((
      select jsonb_agg(code order by position)
      from unnest(array[
        case when p.id is null then 'profile_not_found' end,
        case when p.id is not null and p.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
        case when p.id is not null and not p.is_public then 'profile_not_public' end,
        case when p.id is not null and not p.is_accepting_bookings then 'not_accepting_bookings' end,
        case when p.id is not null and not p.accepts_online_sessions then 'online_sessions_disabled' end,
        case when p.id is not null and coalesce(s.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
        case when p.id is not null and coalesce(s.online_bookable, 0) > 0 and coalesce(s.published_therapy, 0) = 0 then 'therapy_not_public' end,
        case when p.id is not null and coalesce(s.published_therapy, 0) > 0 and coalesce(s.eligible, 0) = 0 then 'therapy_category_inactive' end
      ]) with ordinality as blockers(code, position)
      where code is not null
    ), '[]'::jsonb),
    'eligibleServiceCount', coalesce(s.eligible, 0)
  )
  from profile p full join services s on true
$$;

create or replace view public.public_therapist_profile_content_v
with (security_invoker = true) as
select
  p.slug,
  v.therapist_profile_id,
  v.short_intro,
  v.essence_body,
  v.invitation_body,
  v.experience_years,
  coalesce(guide_items.items, '[]'::jsonb) as guide_items,
  coalesce(reflections.items, '[]'::jsonb) as reflections
from public.therapist_profiles p
join public.therapist_profile_content_versions v on v.therapist_profile_id = p.id
left join lateral (
  select jsonb_agg(jsonb_build_object('icon', i.icon, 'label', i.label) order by i.sort_order) as items
  from public.therapist_profile_guide_items i
  where i.content_version_id = v.id and i.is_active
) guide_items on true
left join lateral (
  select jsonb_agg(jsonb_build_object('href', r.href, 'imageUrl', r.image_url, 'minutesToRead', r.minutes_to_read, 'title', r.title) order by r.sort_order) as items
  from public.therapist_profile_reflections r
  where r.content_version_id = v.id and r.is_public
) reflections on true
where v.status = 'published'
  and public.is_therapist_publication_eligible_v1(p.id);

create or replace view public.public_therapist_slug_redirects_v
with (security_invoker = true) as
select h.old_slug, h.current_slug
from public.therapist_profile_slug_history h
where public.is_therapist_publication_eligible_v1(h.therapist_profile_id);

grant select on public.public_therapist_profile_content_v, public.public_therapist_slug_redirects_v
  to anon, authenticated, service_role;
