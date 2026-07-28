do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'therapy_status'
      and pg_enum.enumlabel = 'in_review'
  ) then
    alter type public.therapy_status add value 'in_review';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'therapy_status'
      and pg_enum.enumlabel = 'deprecated'
  ) then
    alter type public.therapy_status add value 'deprecated';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'service_status'
      and pg_enum.enumlabel = 'requires_review'
  ) then
    alter type public.service_status add value 'requires_review';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'service_status'
      and pg_enum.enumlabel = 'rejected'
  ) then
    alter type public.service_status add value 'rejected';
  end if;
end $$;

comment on type public.therapy_status is
  'Platform therapy editorial lifecycle. Legacy active/inactive remain for compatibility; public catalog uses published.';

comment on type public.service_status is
  'Therapist service operational lifecycle. Only active services can become reservable.';
