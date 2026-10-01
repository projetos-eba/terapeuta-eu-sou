-- Keep the existing contract name while distinguishing an actual promotional
-- promise from a responsible editorial limit. In particular, a note such as
-- "não substitui diagnóstico" must remain possible in the catalog.
create or replace function public.admin_assert_responsible_therapy_text_v1(
  p_value text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text;
begin
  -- A responsible boundary may use the same words as an improper claim. Remove
  -- only a complete negative clause before testing the remaining editorial
  -- text, so it cannot mask an actual promise later in the same sentence.
  v_text := regexp_replace(
    coalesce(p_value, ''),
    '(n[aã]o)[[:space:]]+'
    || '(garante|garantimos|garantem|promete|prometemos|prometem|'
    || 'oferece|oferecemos|oferecem|realiza|realizamos|realizam|'
    || 'faz|fazemos|fazem|entrega|entregamos|entregam)'
    || '[[:space:]]+'
    || '(cura|diagn[oó]stico|tratamento[[:space:]]+m[eé]dico|'
    || 'resultado|transforma[cç][aã]o)'
    || '([[:space:]]*[,;.]|$)',
    '',
    'gi'
  );

  if v_text ~* (
    '(cura|resultado|transforma[cç][aã]o)[[:space:]]+'
    || '(garantid[ao]s?|assegurad[ao]s?|prometid[ao]s?)'
    || '|'
    || '(garante|garantimos|garantem|promete|prometemos|prometem|'
    || 'oferece|oferecemos|oferecem|realiza|realizamos|realizam|'
    || 'faz|fazemos|fazem|entrega|entregamos|entregam)'
    || '[[:space:]]+([^.!;]{0,40}[[:space:]])?'
    || '(cura|diagn[oó]stico|tratamento[[:space:]]+m[eé]dico|'
    || 'resultado|transforma[cç][aã]o)'
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_UNSAFE_COPY';
  end if;
end;
$$;

comment on function public.admin_assert_responsible_therapy_text_v1(text)
  is 'Blocks affirmative editorial promises while allowing responsible limits, such as stating that a practice does not replace professional care.';
