begin;

select plan(24);

select has_table('public', 'email_outbox', 'transactional email outbox exists');
select is(has_table_privilege('anon', 'public.email_outbox', 'SELECT'), false, 'anon cannot read outbox');
select is(has_table_privilege('authenticated', 'public.email_outbox', 'UPDATE'), false, 'authenticated cannot mutate outbox');
select ok(has_function_privilege('service_role', 'public.claim_email_outbox_v1(uuid,integer)', 'EXECUTE'), 'trusted dispatcher can claim work');
select is(has_function_privilege('anon', 'public.claim_email_outbox_v1(uuid,integer)', 'EXECUTE'), false, 'anon cannot claim work');
select is(has_function_privilege('anon', 'public.arm_email_outbox_test_fault_v1(text,text,timestamp with time zone)', 'EXECUTE'), false, 'test hook is not public');

select is(
  (public.submit_therapy_catalog_request_v2(
    'aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_object('informedName', 'Outbox pgTAP', 'submission', jsonb_build_object('description','Descrição responsável.','objective','Objetivo para análise.','themeIds',(select jsonb_agg(theme.id order by theme.sort_order) from public.matching_themes as theme where theme.slug in ('emocoes-bem-estar','relacionamentos')),'useCases','Situações relatadas.','sessionProcess','Atendimento online.')),
    '55100000-0000-4000-8000-000000000001'
  ) ->> 'status'), 'submitted', 'business action succeeds independently of delivery'
);

create temporary table email_outbox_fixture as
select id, action_key, domain_event_id, recipient_key
from public.email_outbox
where action_key = 'therapy_catalog_request_submitted'
order by created_at desc
limit 1;

select is((select count(*)::integer from email_outbox_fixture), 1, 'the test fixture identifies the delivery created for this request');
select is((select count(*)::integer from public.email_outbox where id = (select id from email_outbox_fixture)), 1, 'submit event is atomically enqueued once');
select is((select template_version from public.email_outbox where id = (select id from email_outbox_fixture)), 'v1', 'outbox snapshots the default template version');
select is(jsonb_typeof((select template_overrides from public.email_outbox where id = (select id from email_outbox_fixture))), 'object', 'outbox snapshots template overrides');
select ok((select recipient_key ~ '^profile:' from public.email_outbox where id = (select id from email_outbox_fixture)), 'outbox stores an opaque recipient key');

select is(
  (public.submit_therapy_catalog_request_v2(
    'aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_object('informedName', 'Outbox pgTAP', 'submission', jsonb_build_object('description','Descrição responsável.','objective','Objetivo para análise.','themeIds',(select jsonb_agg(theme.id order by theme.sort_order) from public.matching_themes as theme where theme.slug in ('emocoes-bem-estar','relacionamentos')),'useCases','Situações relatadas.','sessionProcess','Atendimento online.')),
    '55100000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay'), 'true', 'business replay remains idempotent'
);
select is((select count(*)::integer from public.email_outbox where domain_event_id = (select domain_event_id from email_outbox_fixture)), 1, 'business replay does not duplicate the outbox');

insert into public.email_outbox(action_key, domain_event_id, related_entity_type, related_entity_id, recipient_user_id, recipient_key, idempotency_key, payload, template_version, template_overrides)
select action_key, domain_event_id, related_entity_type, related_entity_id, recipient_user_id, 'profile:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', idempotency_key, payload, template_version, template_overrides
from public.email_outbox where id = (select id from email_outbox_fixture);
select is((select count(*)::integer from public.email_outbox where domain_event_id = (select domain_event_id from email_outbox_fixture)), 2, 'a different logical recipient may receive the same action for the same domain event');
select throws_ok(
  $$insert into public.email_outbox(action_key, domain_event_id, related_entity_type, related_entity_id, recipient_user_id, recipient_key, idempotency_key, payload, template_version, template_overrides)
    select action_key, domain_event_id, related_entity_type, related_entity_id, recipient_user_id, recipient_key, idempotency_key, payload, template_version, template_overrides from public.email_outbox where id = (select id from email_outbox_fixture)$$,
  '23505', NULL, 'the same action, domain event and recipient cannot be duplicated'
);

select is((select status::text from public.claim_email_outbox_v1('55100000-0000-4000-8000-000000000010', 1) limit 1), 'processing', 'dispatcher claim locks one pending row');
select ok((select next_attempt_at is null from public.email_outbox where status = 'processing' limit 1), 'claimed work has no retry schedule while its delivery outcome is unknown');
select is((select status::text from public.complete_email_outbox_v1((select id from public.email_outbox where status = 'processing' limit 1), '55100000-0000-4000-8000-000000000010', 'retry_pending', 'provider_unavailable')), 'retry_pending', 'explicit provider rejection schedules retry');
select ok((select next_attempt_at > now() from public.email_outbox where status = 'retry_pending' limit 1), 'retry uses a future backoff time');

update public.email_outbox set status = 'processing', next_attempt_at = null, locked_at = now() - interval '6 minutes', locked_by = '55100000-0000-4000-8000-000000000099' where status = 'pending';
update public.email_outbox set next_attempt_at = now() where status = 'retry_pending';
select is((select count(*)::integer from public.claim_email_outbox_v1('55100000-0000-4000-8000-000000000011', 10) where status = 'processing'), 1, 'active retry work remains claimable while stale lease is finalized');
select ok((select review_required from public.email_outbox where review_reason = 'delivery_outcome_unknown' limit 1), 'stale processing delivery requires review instead of automatic duplicate retry');
select ok((select next_attempt_at is null from public.email_outbox where review_reason = 'delivery_outcome_unknown' limit 1), 'stale processing delivery has no schedule after manual-review finalization');
select is(
  (
    select next_attempt_at
    from public.complete_email_outbox_v1(
      (select id from public.email_outbox where status = 'processing' limit 1),
      '55100000-0000-4000-8000-000000000011',
      'delivered'
    )
  ),
  null,
  'delivered work clears its retry schedule'
);

select * from finish();
rollback;
