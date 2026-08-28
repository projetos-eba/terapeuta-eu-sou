-- Some environments contain legacy CPF duplicates created before the private
-- identity contract existed. Preserve those rows, but reject every new CPF
-- collision until an explicit reconciliation can restore a unique index.

do $$
begin
  if to_regclass('public.therapist_private_identity_cpf_unique_idx') is null then
    create index if not exists therapist_private_identity_cpf_lookup_idx
      on public.therapist_private_identity (document_number)
      where document_type = 'cpf';
  end if;
end;
$$;

create or replace function public.reject_new_duplicate_therapist_cpf_v1()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.document_type <> 'cpf' then
    return new;
  end if;

  -- Existing duplicate holders may still update unrelated private fields.
  if tg_op = 'UPDATE'
    and old.document_type = 'cpf'
    and new.document_number = old.document_number
  then
    return new;
  end if;

  -- Serialize checks for the same normalized CPF to close concurrent writes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes-therapist-private-cpf:' || new.document_number,
      0
    )
  );

  if exists (
    select 1
    from public.therapist_private_identity as existing
    where existing.document_type = 'cpf'
      and existing.document_number = new.document_number
      and existing.id is distinct from new.id
  ) then
    raise exception 'CPF_ALREADY_IN_USE' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_new_duplicate_therapist_cpf_v1() from public, anon, authenticated;

drop trigger if exists reject_new_duplicate_therapist_cpf_v1
  on public.therapist_private_identity;

create trigger reject_new_duplicate_therapist_cpf_v1
before insert or update of document_type, document_number
on public.therapist_private_identity
for each row
execute function public.reject_new_duplicate_therapist_cpf_v1();
