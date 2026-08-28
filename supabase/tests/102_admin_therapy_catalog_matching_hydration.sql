begin;

select plan(3);

select ok(
  jsonb_array_length(
    public.admin_list_therapy_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000090'
    ) -> 'matchingThemes'
  ) >= 1,
  'admin catalog includes active Match themes without a separate public projection'
);

select ok(
  jsonb_array_length(
    (
      select item -> 'matchingThemeIds'
      from jsonb_array_elements(
        public.admin_list_therapy_catalog_v1(
          'aaaaaaaa-0000-4000-8000-000000000090'
        ) -> 'items'
      ) as row(item)
      where item ->> 'slug' = 'reiki'
    )
  ) >= 1,
  'admin catalog includes canonical persisted Match theme links for therapy editing'
);

select is(
  exists (
    select 1
    from jsonb_array_elements(
      public.admin_list_therapy_catalog_v1(
        'aaaaaaaa-0000-4000-8000-000000000090'
      ) -> 'matchingThemes'
    ) as theme(value)
    where value ? 'imageUrl'
  ),
  true,
  'admin theme options retain their public image preview field'
);

select * from finish();

rollback;
