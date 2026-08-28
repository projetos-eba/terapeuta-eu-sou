-- CPF identifies one private therapist identity at a time. RG and passport
-- remain non-unique because they are not a reliable cross-account identifier.
create unique index if not exists therapist_private_identity_cpf_unique_idx
  on public.therapist_private_identity (document_number)
  where document_type = 'cpf';

create or replace function public.save_therapist_private_identity_v1(
  p_document_type text,
  p_document_number text,
  p_postal_code text,
  p_street text,
  p_street_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_country text default 'BR'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_document_type text := lower(btrim(coalesce(p_document_type, '')));
  v_document_number text := upper(regexp_replace(btrim(coalesce(p_document_number, '')), '[^0-9A-Za-z]', '', 'g'));
  v_postal_code text := regexp_replace(btrim(coalesce(p_postal_code, '')), '[^0-9]', '', 'g');
  v_country text := upper(btrim(coalesce(p_country, 'BR')));
  v_cpf_check_1 integer;
  v_cpf_check_2 integer;
begin
  select id into v_profile_id
  from public.therapist_profiles
  where user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'therapist profile required' using errcode = '42501';
  end if;
  if v_document_type not in ('cpf', 'rg', 'passport') then
    raise exception 'invalid document type' using errcode = '22023';
  end if;
  if length(v_document_number) < 6 or length(v_document_number) > 20 then
    raise exception 'invalid document number' using errcode = '22023';
  end if;
  if v_document_type = 'cpf' then
    if v_document_number !~ '^[0-9]{11}$'
      or v_document_number ~ '^([0-9])\1{10}$'
    then
      raise exception 'invalid cpf' using errcode = '22023';
    end if;
    select case
      when mod(sum(substr(v_document_number, position, 1)::integer * (11 - position)), 11) < 2 then 0
      else 11 - mod(sum(substr(v_document_number, position, 1)::integer * (11 - position)), 11)
    end
    into v_cpf_check_1
    from generate_series(1, 9) as series(position);
    select case
      when mod(sum(substr(v_document_number, position, 1)::integer * (12 - position)), 11) < 2 then 0
      else 11 - mod(sum(substr(v_document_number, position, 1)::integer * (12 - position)), 11)
    end
    into v_cpf_check_2
    from generate_series(1, 10) as series(position);
    if v_cpf_check_1 <> substr(v_document_number, 10, 1)::integer
      or v_cpf_check_2 <> substr(v_document_number, 11, 1)::integer
    then
      raise exception 'invalid cpf' using errcode = '22023';
    end if;
  end if;
  if v_document_type = 'passport' and v_document_number !~ '^[A-Z0-9]{6,9}$' then
    raise exception 'invalid passport' using errcode = '22023';
  end if;
  if v_document_type = 'rg' and v_document_number !~ '^[0-9A-Z]{7,14}$' then
    raise exception 'invalid rg' using errcode = '22023';
  end if;
  if v_postal_code !~ '^[0-9]{8}$' then
    raise exception 'invalid postal code' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_street, ''))) not between 2 and 160
    or length(btrim(coalesce(p_street_number, ''))) not between 1 and 20
    or length(btrim(coalesce(p_neighborhood, ''))) not between 2 and 100
    or length(btrim(coalesce(p_city, ''))) not between 2 and 100
    or length(btrim(coalesce(p_state, ''))) not between 2 and 2
    or v_country <> 'BR'
  then
    raise exception 'invalid address' using errcode = '22023';
  end if;

  begin
    insert into public.therapist_private_identity (
      therapist_profile_id, document_type, document_number, postal_code,
      street, street_number, complement, neighborhood, city, state, country
    ) values (
      v_profile_id, v_document_type, v_document_number, v_postal_code,
      btrim(p_street), btrim(p_street_number), nullif(btrim(coalesce(p_complement, '')), ''),
      btrim(p_neighborhood), btrim(p_city), upper(btrim(p_state)), v_country
    )
    on conflict (therapist_profile_id) do update set
      document_type = excluded.document_type,
      document_number = excluded.document_number,
      postal_code = excluded.postal_code,
      street = excluded.street,
      street_number = excluded.street_number,
      complement = excluded.complement,
      neighborhood = excluded.neighborhood,
      city = excluded.city,
      state = excluded.state,
      country = excluded.country,
      updated_at = now();
  exception
    when unique_violation then
      if v_document_type = 'cpf' then
        raise exception 'CPF_ALREADY_IN_USE' using errcode = '23505';
      end if;
      raise;
  end;

  return public.get_therapist_private_identity_v1();
end;
$$;

revoke all on function public.save_therapist_private_identity_v1(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_therapist_private_identity_v1(text, text, text, text, text, text, text, text, text, text) to authenticated, service_role;
