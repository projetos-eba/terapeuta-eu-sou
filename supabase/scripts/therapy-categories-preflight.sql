-- Read-only operational report. Run in HML/production before stage 2.
select
  therapy.id,
  therapy.name,
  therapy.slug,
  therapy.status,
  therapy.is_public_visible,
  therapy.is_available_for_services,
  count(service.id) filter (where service.status = 'active' and service.archived_at is null) as active_service_count
from public.therapies therapy
left join public.therapist_services service on service.therapy_id = therapy.id
where (
  (therapy.status = 'published' and therapy.is_public_visible)
  or therapy.is_available_for_services
  or exists (select 1 from public.therapist_services active_service where active_service.therapy_id = therapy.id and active_service.status = 'active' and active_service.archived_at is null)
) and not public.therapy_has_active_matching_theme_v1(therapy.id)
group by therapy.id, therapy.name, therapy.slug, therapy.status, therapy.is_public_visible, therapy.is_available_for_services
order by therapy.name;
