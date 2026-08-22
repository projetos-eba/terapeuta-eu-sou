begin;

select plan(17);

select has_table(
  'public',
  'therapy_catalog_request_materials',
  'private supporting materials are tracked separately'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)',
    'EXECUTE'
  ),
  'service role can submit a versioned therapy request'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the submission authority directly'
);

select is(
  (
    public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia workflow pgTAP',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order)
            from public.matching_themes as theme
            where theme.slug in ('emocoes-bem-estar', 'relacionamentos')
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000001'
    ) ->> 'status'
  ),
  'submitted',
  'therapist can submit a structured request'
);

select is(
  (
    select jsonb_array_length(submission->'themeIds')
    from public.therapy_catalog_requests
    where informed_name = 'Terapia workflow pgTAP'
    limit 1
  ),
  2,
  'request stores the canonical Match themes selected by the therapist'
);

select is(
  (
    public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia legada pgTAP',
        'suggestedCategoryId', '11111111-1111-4111-8111-111111111117',
        'submission', jsonb_build_object(
          'description', 'Descrição legada preservada para revisão.',
          'objective', 'Objetivo legado para análise.',
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000010'
    ) ->> 'status'
  ),
  'submitted',
  'legacy category submissions remain compatible without themeIds'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida duplicada',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_build_array(theme.id, theme.id)
            from public.matching_themes as theme
            where theme.slug = 'emocoes-bem-estar'
            limit 1
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000011'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'duplicate Match themes are rejected'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida excesso',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order, theme.name)
            from (
              select id, sort_order, name
              from public.matching_themes
              where is_active = true
              order by sort_order, name
              limit 4
            ) as theme
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000012'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'more than three Match themes are rejected'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida desconhecida',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', jsonb_build_array('11111111-1111-4111-8111-111111111111'),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000013'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'unknown Match themes are rejected'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida malformada',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', jsonb_build_array('nao-e-uuid'),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000014'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'malformed theme identifiers are rejected'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida tipo',
        'themeIds', '"nao-e-array"'::jsonb,
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order)
            from public.matching_themes as theme
            where theme.slug in ('emocoes-bem-estar', 'relacionamentos')
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000015'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'non-array themeIds are rejected instead of crashing'
);

select throws_ok(
  $$
    select public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia invalida categoria',
        'suggestedCategoryId', 'categoria-invalida',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order)
            from public.matching_themes as theme
            where theme.slug in ('emocoes-bem-estar', 'relacionamentos')
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000016'
    )
  $$,
  null,
  'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD',
  'invalid legacy category text is rejected with a controlled payload error'
);

select is(
  (
    public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia workflow pgTAP',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order)
            from public.matching_themes as theme
            where theme.slug in ('emocoes-bem-estar', 'relacionamentos')
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000001'
    ) ->> 'idempotentReplay'
  ),
  'true',
  'same client request id is idempotent'
);

select is(
  (
    public.admin_decide_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '55000000-0000-4000-8000-000000000002',
      (select id from public.therapy_catalog_requests where informed_name = 'Terapia workflow pgTAP' limit 1),
      'needs_information',
      'Envie mais contexto sobre os materiais utilizados.',
      null
    ) ->> 'requestStatus'
  ),
  'needs_information',
  'admin can request additional information with an audit decision'
);

select is(
  (
    public.resubmit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select id from public.therapy_catalog_requests where informed_name = 'Terapia workflow pgTAP' limit 1),
      jsonb_build_object(
        'informedName', 'Terapia workflow pgTAP',
        'submission', jsonb_build_object(
          'description', 'Descrição atualizada para a análise.',
          'objective', 'Objetivo informado para análise.',
          'themeIds', (
            select jsonb_agg(theme.id order by theme.sort_order)
            from public.matching_themes as theme
            where theme.slug in ('emocoes-bem-estar', 'relacionamentos')
          ),
          'useCases', 'Situações relatadas pela pessoa terapeuta.',
          'sessionProcess', 'Atendimento online com etapas explicadas.'
        )
      ),
      '55000000-0000-4000-8000-000000000003'
    ) ->> 'status'
  ),
  'submitted',
  'therapist can resubmit only after a request for information'
);

select ok(
  exists (
    select 1 from public.therapy_catalog_events
    where event_type = 'therapy_request_resubmitted'
      and request_id = '55000000-0000-4000-8000-000000000003'
  ),
  'resubmission is audited exactly once'
);

select ok(
  exists (
    select 1 from public.notifications
    where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and kind = 'therapy_catalog_request_updated'
  ),
  'administrative decision creates an internal notification'
);

select * from finish();
rollback;
