begin;

select plan(11);

select has_table('public', 'email_outbox', 'transactional email outbox exists');
select is(has_table_privilege('anon', 'public.email_outbox', 'SELECT'), false, 'anon cannot read outbox');
select is(has_table_privilege('authenticated', 'public.email_outbox', 'UPDATE'), false, 'authenticated cannot mutate outbox');
select ok(has_function_privilege('service_role', 'public.claim_email_outbox_v1(uuid,integer)', 'EXECUTE'), 'trusted dispatcher can claim work');
select is(has_function_privilege('anon', 'public.claim_email_outbox_v1(uuid,integer)', 'EXECUTE'), false, 'anon cannot claim work');

select is(
  (public.submit_therapy_catalog_request_v2(
    'aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_object('informedName', 'Outbox pgTAP', 'suggestedCategoryId', '11111111-1111-4111-8111-111111111117', 'submission', jsonb_build_object('description','Descrição responsável.','objective','Objetivo para análise.','useCases','Situações relatadas.','sessionProcess','Atendimento online.')),
    '55100000-0000-4000-8000-000000000001'
  ) ->> 'status'), 'submitted', 'business action succeeds independently of delivery'
);

select is((select count(*)::integer from public.email_outbox where action_key = 'therapy_catalog_request_submitted'), 1, 'submit event is atomically enqueued once');

select is(
  (public.submit_therapy_catalog_request_v2(
    'aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_object('informedName', 'Outbox pgTAP', 'suggestedCategoryId', '11111111-1111-4111-8111-111111111117', 'submission', jsonb_build_object('description','Descrição responsável.','objective','Objetivo para análise.','useCases','Situações relatadas.','sessionProcess','Atendimento online.')),
    '55100000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay'), 'true', 'business replay remains idempotent'
);

select is((select count(*)::integer from public.email_outbox where action_key = 'therapy_catalog_request_submitted'), 1, 'business replay does not duplicate the outbox');

select is((select status::text from public.claim_email_outbox_v1('55100000-0000-4000-8000-000000000010', 1) limit 1), 'processing', 'dispatcher claim locks one pending row');
select is((select status::text from public.complete_email_outbox_v1((select id from public.email_outbox limit 1), '55100000-0000-4000-8000-000000000010', 'retry_pending', 'provider_unavailable')), 'retry_pending', 'provider failure schedules retry without changing business action');

select * from finish();
rollback;
