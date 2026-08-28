begin;

select plan(21);

select has_column('public', 'support_tickets', 'assigned_admin_id', 'support inbox persists administrative assignment');
select has_function('public', 'admin_get_support_inbox_v1', array['jsonb'], 'admin inbox read boundary exists');
select has_function('public', 'admin_manage_support_ticket_v1', array['uuid', 'uuid', 'text', 'text'], 'admin inbox mutation boundary exists');
select is(
  has_function_privilege('anon', 'public.admin_get_support_inbox_v1(jsonb)', 'EXECUTE'),
  false,
  'anonymous users cannot execute the support inbox read boundary'
);

insert into public.profiles (id, role, display_name, email)
values
  ('e1000000-0000-4000-8000-000000000001', 'therapist', 'Terapeuta Inbox A', 'therapist.inbox.a@example.test'),
  ('e1000000-0000-4000-8000-000000000002', 'therapist', 'Terapeuta Inbox B', 'therapist.inbox.b@example.test'),
  ('e1000000-0000-4000-8000-000000000003', 'admin', 'Admin Inbox', 'admin.inbox@example.test')
on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_support_ticket_v1(
    'e2000000-0000-4000-8000-000000000001'::uuid,
    'financeiro_repasses',
    'Dúvida da Inbox',
    'Preciso de contexto sobre o repasse.',
    null,
    'message_center'
  ) $$,
  'requester creates a support ticket before inbox triage'
);
select set_config('test.inbox_ticket_id', (
  select id::text from public.support_tickets
  where request_id = 'e2000000-0000-4000-8000-000000000001'::uuid
), true);
select lives_ok(
  $$ select public.send_support_ticket_requester_message_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000002'::uuid,
    'Complemento para que a equipe TES possa agir.'
  ) $$,
  'requester transitions own ticket to waiting_support before triage'
);

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_support_ticket_v1(
    'e2000000-0000-4000-8000-000000000010'::uuid,
    'outro',
    'Chamado mais recente da Inbox',
    'Este chamado precisa aparecer no topo da lista.',
    null,
    'message_center'
  ) $$,
  'a second requester creates a newer support ticket'
);
select set_config('test.inbox_newer_ticket_id', (
  select id::text from public.support_tickets
  where request_id = 'e2000000-0000-4000-8000-000000000010'::uuid
), true);
set local role postgres;
update public.support_tickets
set last_activity_at = clock_timestamp() + interval '1 minute'
where id = current_setting('test.inbox_newer_ticket_id')::uuid;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  (select (public.admin_get_support_inbox_v1('{}'::jsonb)->>'attentionCount')::integer),
  1,
  'admin inbox counts waiting_support work as attention'
);
select is(
  (select public.admin_get_support_inbox_v1('{}'::jsonb)->'rows'->0->>'id'),
  current_setting('test.inbox_newer_ticket_id'),
  'admin inbox orders the most recently active ticket first regardless of status'
);
select lives_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000003'::uuid,
    'assign_self'
  ) $$,
  'authorized admin can assign a ticket to self'
);
select is(
  public.admin_get_support_ticket_management_v1(current_setting('test.inbox_ticket_id')::uuid)->>'assignedAdminId',
  auth.uid()::text,
  'assignment is derived from authenticated admin rather than browser identity'
);
select lives_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000004'::uuid,
    'set_priority',
    'high'
  ) $$,
  'authorized admin can set a supported priority'
);
select is(
  public.admin_get_support_ticket_management_v1(current_setting('test.inbox_ticket_id')::uuid)->>'priority',
  'high',
  'priority persists on the ticket'
);
select throws_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000005'::uuid,
    'set_priority',
    'critical'
  ) $$,
  '22023',
  'support priority is invalid',
  'unsupported priority is rejected server-side'
);
select lives_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000006'::uuid,
    'start'
  ) $$,
  'admin can start work from waiting_support'
);
select is(
  public.admin_get_support_ticket_management_v1(current_setting('test.inbox_ticket_id')::uuid)->>'status',
  'in_progress',
  'start transition is persisted'
);
select lives_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000007'::uuid,
    'resolve'
  ) $$,
  'admin can resolve an active ticket'
);
select is(
  public.admin_get_support_ticket_management_v1(current_setting('test.inbox_ticket_id')::uuid)->>'status',
  'resolved',
  'resolution transition is persisted'
);
select throws_ok(
  $$ select public.admin_reply_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000008'::uuid,
    'Resposta pública fora de uma transição permitida.'
  ) $$,
  '22023',
  'support ticket cannot receive a public reply in current status',
  'admin reply cannot bypass the resolved lifecycle'
);
select ok(
  exists(
    select 1 from public.admin_audit_events
    where entity_id = current_setting('test.inbox_ticket_id')
      and action = 'support.set_priority'
  ),
  'priority mutation creates a separate administrative audit event'
);

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_manage_support_ticket_v1(
    current_setting('test.inbox_ticket_id')::uuid,
    'e2000000-0000-4000-8000-000000000009'::uuid,
    'reopen'
  ) $$,
  '42501',
  'authorized admin required',
  'requester cannot use administrative assignment or lifecycle mutations'
);

reset role;
select * from finish();
rollback;
