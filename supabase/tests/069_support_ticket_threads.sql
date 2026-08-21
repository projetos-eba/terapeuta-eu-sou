begin;

select plan(25);

select has_table('public', 'support_ticket_messages', 'support ticket thread table exists');
select has_column('public', 'support_tickets', 'last_activity_at', 'ticket activity is persisted');
select has_column('public', 'support_tickets', 'resolved_at', 'ticket resolution is persisted');
select is(
  has_table_privilege('authenticated', 'public.support_tickets', 'INSERT'),
  false,
  'requesters cannot directly create tickets with arbitrary identity'
);
select is(
  has_table_privilege('authenticated', 'public.support_ticket_messages', 'INSERT'),
  false,
  'requesters cannot directly create public or internal thread messages'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_support_ticket_v1(
      'f9000000-0000-4000-8000-000000000001'::uuid,
      'financeiro_repasses',
      'Dúvida sobre repasse',
      'Preciso entender quando o valor ficará disponível.',
      null,
      'message_center'
    )
  $$,
  'therapist can create a free-text ticket through the controlled RPC'
);

select is(
  (select count(*) from public.support_tickets where request_id = 'f9000000-0000-4000-8000-000000000001'::uuid),
  1::bigint,
  'ticket creation is idempotent by requester and request id'
);

select set_config(
  'test.support_ticket_id',
  (select id::text from public.support_tickets where request_id = 'f9000000-0000-4000-8000-000000000001'::uuid),
  true
);

select is(
  (select count(*) from public.support_ticket_messages where ticket_id = current_setting('test.support_ticket_id')::uuid),
  1::bigint,
  'initial description is materialized once as the canonical public thread message'
);

select throws_ok(
  $$
    insert into public.support_ticket_messages (ticket_id, author_profile_id, author_role, body, visibility, request_id)
    values ('f8000000-0000-4000-8000-000000000001', auth.uid(), 'therapist', 'nota interna proibida', 'internal', 'f9000000-0000-4000-8000-000000000099')
  $$,
  '42501',
  null,
  'therapist cannot create an internal note directly'
);

select lives_ok(
  $$
    select public.send_support_ticket_requester_message_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000002'::uuid,
      'Posso complementar com mais detalhes sobre o repasse.'
    )
  $$,
  'therapist can reply publicly to own ticket'
);

select is(
  (select status from public.support_tickets where request_id = 'f9000000-0000-4000-8000-000000000001'::uuid),
  'waiting_support',
  'requester reply persists waiting_support lifecycle state'
);

select is(
  (select count(*) from public.support_ticket_messages where ticket_id = current_setting('test.support_ticket_id')::uuid),
  2::bigint,
  'requester message is not duplicated by its first submission'
);

select lives_ok(
  $$
    select public.send_support_ticket_requester_message_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000002'::uuid,
      'Texto de retry não substitui a mensagem original.'
    )
  $$,
  'requester retry is accepted idempotently'
);

select is(
  (select count(*) from public.support_ticket_messages where ticket_id = current_setting('test.support_ticket_id')::uuid),
  2::bigint,
  'requester retry does not create a duplicate message'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.support_tickets where request_id = 'f9000000-0000-4000-8000-000000000001'::uuid),
  0::bigint,
  'therapist B cannot read therapist A ticket'
);

select throws_ok(
  $$
    select public.send_support_ticket_requester_message_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000003'::uuid,
      'Tentativa em ticket alheio.'
    )
  $$,
  '42501',
  'support ticket requester required',
  'therapist B cannot write therapist A ticket'
);

reset role;

insert into public.profiles (id, role, display_name, email)
values ('dddddddd-0000-4000-8000-000000000001', 'admin', 'Admin de teste', 'admin.support@example.test')
on conflict (id) do update set role = excluded.role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.admin_add_support_ticket_note_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000004'::uuid,
      'Nota interna da equipe.'
    )
  $$,
  'authorized admin can create an internal note'
);
select lives_ok(
  $$
    select public.admin_reply_support_ticket_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000005'::uuid,
      'A equipe TES recebeu sua mensagem e está acompanhando.'
    )
  $$,
  'authorized admin can send a public reply'
);

select is(
  (select count(*) from public.admin_get_support_ticket_thread_v1(current_setting('test.support_ticket_id')::uuid)),
  4::bigint,
  'authorized admin reads the complete support thread including the internal note'
);
select is(
  (
    select count(*)
    from public.admin_get_support_ticket_thread_v1(current_setting('test.support_ticket_id')::uuid)
    where visibility = 'internal'
  ),
  1::bigint,
  'admin thread contract preserves internal note visibility'
);
select throws_ok(
  $$
    select public.admin_get_support_ticket_thread_v1('00000000-0000-4000-8000-000000000099'::uuid)
  $$,
  'P0002',
  'support ticket not found',
  'admin thread read rejects an unknown ticket'
);

select lives_ok(
  $$
    select public.admin_execute_operation_command_v2(
      'support.resolve',
      current_setting('test.support_ticket_id')::uuid,
      'Chamado solucionado pela equipe TES.',
      'support-ticket-resolve-test',
      '{}'::jsonb,
      null
    )
  $$,
  'authorized admin can resolve a ticket through the existing audited command'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.support_ticket_messages where ticket_id = current_setting('test.support_ticket_id')::uuid),
  3::bigint,
  'requester sees only public thread messages and never the internal note'
);

select lives_ok(
  $$
    select public.send_support_ticket_requester_message_v1(
      current_setting('test.support_ticket_id')::uuid,
      'f9000000-0000-4000-8000-000000000006'::uuid,
      'Ainda preciso de ajuda com este chamado.'
    )
  $$,
  'requester can explicitly reopen a resolved ticket by replying'
);
select is(
  (select status from public.support_tickets where id = current_setting('test.support_ticket_id')::uuid),
  'waiting_support',
  'resolved ticket reply reopens the lifecycle for TES and clears resolution'
);

reset role;
select * from finish();
rollback;
