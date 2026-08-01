-- Hidden therapies must not be available for new therapist services.
-- Reversal strategy: set is_available_for_services = true again only after
-- the therapy is intentionally published on public surfaces by Admin.

update public.therapies
set
  is_available_for_services = false,
  updated_at = now()
where slug = 'aromaterapia'
  and is_public_visible = false;

update public.therapist_services as service
set
  status = 'archived',
  is_bookable = false,
  archived_at = coalesce(service.archived_at, now()),
  updated_at = now()
from public.therapies as therapy
where therapy.id = service.therapy_id
  and therapy.slug = 'aromaterapia'
  and therapy.is_public_visible = false
  and service.status <> 'archived';
