-- H1 hardening: matching therapy catalog must not rely on view-owner RLS
-- bypass. Its dependencies now have explicit public grants/RLS.

create or replace view public.public_matching_therapies_v
with (security_invoker = true) as
select
  public_therapy_details_v.id,
  public_therapy_details_v.name,
  public_therapy_details_v.slug,
  public_therapy_details_v.short_description,
  public_therapy_details_v.description,
  public_therapy_details_v.image_url,
  therapies.status,
  public_therapy_details_v.therapist_count,
  matching_therapy_settings.is_visible_in_matching
from public.public_therapy_details_v
join public.therapies
  on therapies.id = public_therapy_details_v.id
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = public_therapy_details_v.id
where therapies.status = 'published'::public.therapy_status
  and therapies.is_public_visible is true
  and therapies.archived_at is null
  and matching_therapy_settings.is_visible_in_matching is true;

revoke all on public.public_matching_therapies_v
from public, anon, authenticated, service_role;

grant select on public.public_matching_therapies_v
to anon, authenticated, service_role;

comment on view public.public_matching_therapies_v is
  'Public Match therapy DTO. Runs as security_invoker and depends on explicit public therapy and matching settings RLS.';
