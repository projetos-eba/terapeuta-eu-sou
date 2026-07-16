insert into public.matching_therapy_settings (therapy_id, is_visible_in_matching)
select therapies.id, true
from public.therapies
where therapies.status = 'published'
  and therapies.slug in (
    'terapia-integrativa',
    'terapia-floral',
    'meditacao-guiada',
    'reiki',
    'aromaterapia'
  )
on conflict (therapy_id) do update
set
  is_visible_in_matching = excluded.is_visible_in_matching,
  updated_at = now();
