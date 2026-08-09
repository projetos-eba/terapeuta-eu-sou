begin;

select plan(20);

select ok(
  to_regprocedure(
    'public.admin_execute_operation_command_v1(text,uuid,text,text,jsonb,text)'
  ) is not null,
  'admin operation command RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_execute_operation_command_v1(text,uuid,text,text,jsonb,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin operation commands'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_execute_operation_command_v1(text,uuid,text,text,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated role can invoke command RPC after in-function admin validation'
);

create temporary table admin_operation_command_fixture as
select
  (
    select id
    from public.therapist_profiles
    order by id
    limit 1
  ) as therapist_profile_id,
  (
    select id
    from public.reviews
    order by id
    limit 1
  ) as review_id,
  (
    select id
    from public.bookings
    order by id
    limit 1
  ) as booking_id;

grant select on admin_operation_command_fixture to authenticated;

update public.therapist_profiles
set
  status = 'approved'::public.therapist_status,
  is_public = true,
  is_accepting_bookings = true
where id = (
  select therapist_profile_id
  from admin_operation_command_fixture
);

update public.reviews
set status = 'published'::public.review_status
where id = (
  select review_id
  from admin_operation_command_fixture
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    'select public.admin_execute_operation_command_v1(''professional.suspend'', %L::uuid, ''Motivo operacional valido'', ''non-admin-request'')',
    (select therapist_profile_id from admin_operation_command_fixture)
  ),
  '42501',
  'admin permission required',
  'non-admin actor cannot execute admin operation command'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select throws_ok(
  format(
    'select public.admin_execute_operation_command_v1(''professional.suspend'', %L::uuid, ''curto'', ''short-reason-request'')',
    (select therapist_profile_id from admin_operation_command_fixture)
  ),
  '22023',
  'admin command reason must have at least 8 characters',
  'command reason is mandatory and meaningful'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''professional.suspend'', %L::uuid, ''Suspensao operacional auditada'', ''professional-suspend-1'')',
    (select therapist_profile_id from admin_operation_command_fixture)
  ),
  'admin can suspend a professional'
);

select is(
  (
    select status::text
    from public.therapist_profiles
    where id = (
      select therapist_profile_id
      from admin_operation_command_fixture
    )
  ),
  'suspended',
  'professional suspension sets therapist status to suspended'
);

select is(
  (
    select is_public
    from public.therapist_profiles
    where id = (
      select therapist_profile_id
      from admin_operation_command_fixture
    )
  ),
  false,
  'professional suspension removes public visibility'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''professional.suspend'', %L::uuid, ''Suspensao operacional auditada'', ''professional-suspend-1'')',
    (select therapist_profile_id from admin_operation_command_fixture)
  ),
  'duplicate professional suspension request is safe'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'professional-suspend-1'
      and action = 'professional.suspend'
      and entity_type = 'therapist_profile'
  ),
  1,
  'duplicate request_id does not duplicate audit event'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''professional.reactivate'', %L::uuid, ''Reativacao operacional auditada'', ''professional-reactivate-1'')',
    (select therapist_profile_id from admin_operation_command_fixture)
  ),
  'admin can reactivate a suspended professional'
);

insert into public.therapist_verifications (
  therapist_profile_id,
  status
)
select therapist_profile_id, 'submitted'::public.therapist_status
from admin_operation_command_fixture;

create temporary table admin_operation_command_verification as
select id as verification_id
from public.therapist_verifications
where therapist_profile_id = (
  select therapist_profile_id
  from admin_operation_command_fixture
)
order by created_at desc, id desc
limit 1;

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''verification.approve'', %L::uuid, ''Documentacao revisada e aprovada'', ''verification-approve-1'')',
    (select verification_id from admin_operation_command_verification)
  ),
  'admin can approve therapist verification'
);

select is(
  (
    select status::text
    from public.therapist_verifications
    where id = (
      select verification_id
      from admin_operation_command_verification
    )
  ),
  'approved',
  'verification approve sets verification status to approved'
);

insert into public.support_tickets (
  requester_profile_id,
  category,
  subject,
  description,
  status,
  priority
)
select
  profiles.id,
  'admin_test',
  'Ticket de teste admin',
  'Descricao sensivel',
  'open',
  'normal'
from public.profiles
limit 1;

create temporary table admin_operation_command_support as
select id as support_ticket_id
from public.support_tickets
where subject = 'Ticket de teste admin'
order by created_at desc, id desc
limit 1;

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''support.resolve'', %L::uuid, ''Ticket resolvido pela operacao'', ''support-resolve-1'')',
    (select support_ticket_id from admin_operation_command_support)
  ),
  'admin can resolve support ticket'
);

select is(
  (
    select status
    from public.support_tickets
    where id = (
      select support_ticket_id
      from admin_operation_command_support
    )
  ),
  'resolved',
  'support resolve sets ticket status to resolved'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''support.reopen'', %L::uuid, ''Ticket reaberto pela operacao'', ''support-reopen-1'')',
    (select support_ticket_id from admin_operation_command_support)
  ),
  'admin can reopen support ticket'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''review.hide'', %L::uuid, ''Moderacao operacional da avaliacao'', ''review-hide-1'')',
    (select review_id from admin_operation_command_fixture)
  ),
  'admin can hide review'
);

select is(
  (
    select status::text
    from public.reviews
    where id = (
      select review_id
      from admin_operation_command_fixture
    )
  ),
  'hidden',
  'review hide sets status to hidden'
);

select lives_ok(
  format(
    'select public.admin_execute_operation_command_v1(''review.restore'', %L::uuid, ''Restauracao operacional da avaliacao'', ''review-restore-1'')',
    (select review_id from admin_operation_command_fixture)
  ),
  'admin can restore review'
);

select throws_ok(
  format(
    'select public.admin_execute_operation_command_v1(''booking.cancel'', %L::uuid, ''Cancelamento nao permitido aqui'', ''unsupported-command-1'')',
    (select booking_id from admin_operation_command_fixture)
  ),
  '22023',
  'unsupported admin operation command: booking.cancel',
  'unsupported destructive session command fails closed'
);

select * from finish();

rollback;
