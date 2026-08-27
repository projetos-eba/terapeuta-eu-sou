begin;

select plan(12);

select has_column('public', 'support_tickets', 'protocol', 'support tickets persist a readable protocol');
select col_not_null('public', 'support_tickets', 'protocol', 'every support ticket has a protocol');

insert into public.profiles (id, role, display_name, email)
values
  ('f1000000-0000-4000-8000-000000000001', 'therapist', 'Terapeuta Protocolo', 'therapist.protocol@example.test'),
  ('f1000000-0000-4000-8000-000000000002', 'admin', 'Admin Protocolo', 'admin.protocol@example.test')
on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_support_ticket_v1(
    'f2000000-0000-4000-8000-000000000001'::uuid,
    'pagamentos',
    'Pagamento em análise',
    'Preciso confirmar uma atualização de pagamento.',
    null,
    'message_center'
  ) $$,
  'ticket creation assigns a protocol automatically'
);

select set_config('test.protocol_ticket_id', (
  select id::text from public.support_tickets
  where request_id = 'f2000000-0000-4000-8000-000000000001'::uuid
), true);

select matches(
  (select protocol from public.support_tickets where id = current_setting('test.protocol_ticket_id')::uuid),
  '^[0-9]{9}P$',
  'payment ticket has nine digits and the P suffix'
);

select is(
  (select protocol from public.support_tickets where id = current_setting('test.protocol_ticket_id')::uuid),
  (select protocol from public.create_support_ticket_v1(
    'f2000000-0000-4000-8000-000000000001'::uuid,
    'pagamentos',
    'Pagamento em análise',
    'Preciso confirmar uma atualização de pagamento.',
    null,
    'message_center'
  )),
  'idempotent creation preserves the persisted protocol'
);

reset role;

select throws_ok(
  format(
    'update public.support_tickets set protocol = %L where id = %L::uuid',
    '000000000P', current_setting('test.protocol_ticket_id')
  ),
  'P0001',
  'support ticket protocol is immutable',
  'protocol cannot be changed after creation'
);

with created as (
  insert into public.support_tickets (
    requester_profile_id, category, subject, status, priority, source, last_activity_at
  )
  values (
    'f1000000-0000-4000-8000-000000000001'::uuid,
    'agenda_sessoes',
    'Agenda',
    'open',
    'normal',
    'message_center',
    now()
  )
  returning id
)
select set_config('test.protocol_agenda_ticket_id', (select id::text from created), true);

select matches(
  (select protocol from public.support_tickets where id = current_setting('test.protocol_agenda_ticket_id')::uuid),
  '^[0-9]{9}A$',
  'agenda ticket receives the A suffix'
);

select is(
  (select count(*) from public.support_tickets where protocol = (select protocol from public.support_tickets where id = current_setting('test.protocol_agenda_ticket_id')::uuid)),
  1::bigint,
  'generated protocol is unique'
);

select is(
  public.support_ticket_protocol_suffix_v1('zoom_acesso'),
  'Z',
  'zoom category maps to Z'
);
select is(
  public.support_ticket_protocol_suffix_v1('financeiro_repasses'),
  'F',
  'financial category maps to F'
);
select is(
  public.support_ticket_protocol_suffix_v1('unknown'),
  'O',
  'unknown legacy category maps to O'
);

select has_index('public', 'support_tickets', 'support_tickets_protocol_key', 'protocol lookup is indexed');

select * from finish();
rollback;
