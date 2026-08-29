-- Stage 2: this runs only after the operational preflight in
-- scripts/therapy-categories-preflight.sql reports no eligible therapy without
-- an active Match theme.  Every physical removal is RESTRICT-only.

do $$
begin
  if exists (
    select 1 from public.therapies therapy
    where (therapy.status = 'published' and therapy.is_public_visible)
       or therapy.is_available_for_services
       or exists (
         select 1 from public.therapist_services service
         where service.therapy_id = therapy.id and service.status = 'active' and service.archived_at is null
       )
    and not public.therapy_has_active_matching_theme_v1(therapy.id)
  ) then
    raise exception 'THERAPY_CATEGORY_RETIREMENT_PREFLIGHT_FAILED';
  end if;
end;
$$;

update public.therapy_catalog_requests request
set submission = jsonb_set(
  coalesce(request.submission, '{}'::jsonb),
  '{legacy,category}',
  jsonb_strip_nulls(jsonb_build_object('id', category.id, 'name', category.name, 'slug', category.slug)),
  true
)
from public.therapy_categories category
where request.suggested_category_id = category.id;

alter table public.therapy_catalog_requests
  drop column suggested_category_id restrict;
drop index if exists public.therapies_category_idx;
alter table public.therapies drop column category_id restrict;
drop table public.therapy_categories restrict;
