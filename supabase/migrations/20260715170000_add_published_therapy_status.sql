do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'therapy_status'
      and pg_enum.enumlabel = 'published'
  ) then
    alter type public.therapy_status add value 'published' after 'active';
  end if;
end $$;
