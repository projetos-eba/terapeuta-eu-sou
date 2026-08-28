begin;

select plan(13);

select has_table(
  'public',
  'therapy_faqs',
  'legacy therapy FAQ rows remain preserved in the database'
);

select is(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_therapy_details_v'
      and column_name = 'faqs'
  ),
  false,
  'public therapy detail projection has no FAQ column'
);

select is(
  has_table_privilege('anon', 'public.therapy_faqs', 'SELECT'),
  false,
  'anonymous users cannot read preserved legacy FAQ rows'
);

select is(
  has_table_privilege('authenticated', 'public.therapy_faqs', 'SELECT'),
  false,
  'authenticated users cannot read preserved legacy FAQ rows'
);

select is(
  (select count(*) from jsonb_object_keys(
    public.admin_list_therapy_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000090'
    ) -> 'items' -> 0 -> 'publicContent'
  ) as keys(key) where key = 'faqs'),
  0::bigint,
  'admin catalog projection has no FAQ property'
);

select ok(
  (
    public.admin_upsert_therapy_draft_with_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad200000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'name', 'Terapia sem FAQ pgTAP',
        'slug', 'terapia-sem-faq-pgtap',
        'categoryId', (select id from public.therapy_categories order by sort_order, id limit 1),
        'shortDescription', 'Resumo de teste sem FAQ.',
        'description', 'Abordagem editorial segura para teste.',
        'imageUrl', '/therapies/reiki.png',
        'isPubliclyVisible', true,
        'isAvailableForServices', false,
        'isVisibleInMatching', true,
        'themeIds', jsonb_build_array((select id from public.matching_themes where is_active order by sort_order, id limit 1)),
        'highlights', jsonb_build_array(jsonb_build_object('title', 'Presença', 'iconKey', 'sparkles')),
        'benefits', jsonb_build_array(jsonb_build_object('title', 'Escuta', 'description', null, 'iconKey', 'heart')),
        'publicContent', jsonb_build_object('introduction', 'Uma apresentação segura e responsável.'),
        'reason', 'Cobertura de FAQ removido.'
      )
    ) ->> 'therapyId'
  ) is not null,
  'admin can save a therapy without a FAQ payload'
);

select is(
  (
    select count(*)
    from public.therapy_faqs
    where therapy_id = (select id from public.therapies where slug = 'terapia-sem-faq-pgtap')
  ),
  0::bigint,
  'saving a therapy does not create legacy FAQ rows'
);

select lives_ok(
  $$
    select public.admin_validate_therapy_publishable_v1(
      (select id from public.therapies where slug = 'terapia-sem-faq-pgtap')
    )
  $$,
  'publication validation does not require a FAQ'
);

select lives_ok(
  $$
    select public.admin_transition_therapy_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad200000-0000-4000-8000-000000000002',
      (select id from public.therapies where slug = 'terapia-sem-faq-pgtap'),
      'publish',
      'Publicar teste sem FAQ.',
      '{}'::jsonb
    )
  $$,
  'therapy without FAQ can be published'
);

select is(
  (select status::text from public.therapies where slug = 'terapia-sem-faq-pgtap'),
  'published',
  'publication changes the therapy status'
);

select is(
  (select is_available_for_services from public.therapies where slug = 'terapia-sem-faq-pgtap'),
  true,
  'publication automatically enables the therapist service catalog'
);

select is(
  exists (
    select 1
    from public.therapist_service_allowed_catalog_v1
    where therapy_slug = 'terapia-sem-faq-pgtap'
  ),
  true,
  'published therapy appears in the catalog used by therapists'
);

select is(
  exists (
    select 1
    from public.public_therapy_details_v
    where slug = 'terapia-sem-faq-pgtap'
  ),
  true,
  'published therapy remains available in the public detail projection'
);

select * from finish();

rollback;
