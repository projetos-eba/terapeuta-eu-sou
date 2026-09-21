-- Preserve legacy therapist phone duplicates while rejecting each new
-- normalized DDI + national-number collision. A later, explicitly reviewed
-- reconciliation may replace this guard with a unique index.

create index if not exists profiles_therapist_phone_lookup_idx
  on public.profiles (
    coalesce(
      nullif(regexp_replace(coalesce(phone_country_code, ''), '[^0-9]', '', 'g'), ''),
      '55'
    ),
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
  )
  where role = 'therapist'
    and nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '') is not null;

create or replace function public.reject_new_duplicate_therapist_phone_v1()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone_digits text;
  v_country_code text;
begin
  v_phone_digits := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');

  if new.role <> 'therapist' or nullif(v_phone_digits, '') is null then
    return new;
  end if;

  v_country_code := coalesce(
    nullif(
      regexp_replace(coalesce(new.phone_country_code, ''), '[^0-9]', '', 'g'),
      ''
    ),
    '55'
  );

  -- Legacy duplicate holders may retain the same normalized phone while
  -- changing an unrelated value or re-saving their account settings.
  if tg_op = 'UPDATE'
    and old.role = 'therapist'
    and v_phone_digits = regexp_replace(coalesce(old.phone, ''), '[^0-9]', '', 'g')
    and v_country_code = coalesce(
      nullif(
        regexp_replace(coalesce(old.phone_country_code, ''), '[^0-9]', '', 'g'),
        ''
      ),
      '55'
    )
  then
    return new;
  end if;

  -- Serialize writes for the same canonical phone so concurrent signups and
  -- settings updates cannot both pass the lookup.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes-therapist-phone:' || v_country_code || ':' || v_phone_digits,
      0
    )
  );

  if exists (
    select 1
    from public.profiles as existing
    where existing.role = 'therapist'
      and existing.id is distinct from new.id
      and coalesce(
        nullif(
          regexp_replace(
            coalesce(existing.phone_country_code, ''),
            '[^0-9]',
            '',
            'g'
          ),
          ''
        ),
        '55'
      ) = v_country_code
      and regexp_replace(coalesce(existing.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
  ) then
    raise exception 'PHONE_ALREADY_IN_USE' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_new_duplicate_therapist_phone_v1()
  from public, anon, authenticated;

drop trigger if exists reject_new_duplicate_therapist_phone_v1
  on public.profiles;

create trigger reject_new_duplicate_therapist_phone_v1
before insert or update of role, phone, phone_country_code
on public.profiles
for each row
execute function public.reject_new_duplicate_therapist_phone_v1();

comment on function public.reject_new_duplicate_therapist_phone_v1() is
  'Transitional therapist-only phone uniqueness guard. Canonicalizes country code and national digits, preserves legacy duplicates, and serializes concurrent writes.';
