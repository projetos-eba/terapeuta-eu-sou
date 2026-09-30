-- Keep the server-side catalog validation aligned with the form counters.
-- These limits apply only to new or edited content; existing catalog records
-- remain untouched.

create or replace function public.admin_assert_therapy_content_lengths_v1(
  p_payload jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_benefit jsonb;
begin
  if char_length(coalesce(p_payload->>'shortDescription', '')) > 150 then
    raise exception 'ADMIN_THERAPY_CATALOG_SHORT_DESCRIPTION_TOO_LONG';
  end if;
  if char_length(coalesce(p_payload->>'description', '')) > 200 then
    raise exception 'ADMIN_THERAPY_CATALOG_DESCRIPTION_TOO_LONG';
  end if;
  if char_length(coalesce(p_payload#>>'{publicContent,introduction}', '')) > 240 then
    raise exception 'ADMIN_THERAPY_CATALOG_INTRODUCTION_TOO_LONG';
  end if;
  if char_length(coalesce(p_payload#>>'{publicContent,complementaryDescription}', '')) > 200 then
    raise exception 'ADMIN_THERAPY_CATALOG_COMPLEMENTARY_DESCRIPTION_TOO_LONG';
  end if;
  if char_length(coalesce(p_payload#>>'{publicContent,safetyNote}', '')) > 150 then
    raise exception 'ADMIN_THERAPY_CATALOG_SAFETY_NOTE_TOO_LONG';
  end if;

  for v_benefit in
    select value
    from jsonb_array_elements(coalesce(p_payload->'benefits', '[]'::jsonb)) as items(value)
  loop
    if char_length(coalesce(v_benefit->>'description', '')) > 100 then
      raise exception 'ADMIN_THERAPY_CATALOG_BENEFIT_DESCRIPTION_TOO_LONG';
    end if;
  end loop;
end;
$$;

revoke all on function public.admin_assert_therapy_content_lengths_v1(jsonb)
  from public, anon, authenticated;

comment on function public.admin_assert_therapy_content_lengths_v1(jsonb) is
  'Validates editable therapy catalog content. Short summary permits 150 characters and the public introduction permits 240 characters; remaining field limits are unchanged.';
