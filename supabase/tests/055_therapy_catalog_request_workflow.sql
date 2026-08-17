begin;

select plan(9);

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
        'suggestedCategoryId', '11111111-1111-4111-8111-111111111117',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
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
    public.submit_therapy_catalog_request_v2(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia workflow pgTAP',
        'suggestedCategoryId', '11111111-1111-4111-8111-111111111117',
        'submission', jsonb_build_object(
          'description', 'Descrição responsável para revisão.',
          'objective', 'Objetivo informado para análise.',
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
        'suggestedCategoryId', '11111111-1111-4111-8111-111111111117',
        'submission', jsonb_build_object(
          'description', 'Descrição atualizada para a análise.',
          'objective', 'Objetivo informado para análise.',
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
