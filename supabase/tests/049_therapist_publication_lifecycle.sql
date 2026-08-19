begin;

select plan(17);

select ok(
  to_regprocedure('public.get_therapist_publication_eligibility_v1(uuid)') is not null,
  'canonical publication eligibility RPC exists'
);

update public.therapist_profiles
set status = 'submitted'::public.therapist_status,
    is_public = true,
    is_accepting_bookings = true,
    accepts_online_sessions = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set status = 'active', is_bookable = true, online_only = true, archived_at = null
where id = 'd1000000-0000-4000-8000-000000000001';

insert into public.therapist_verifications (id, therapist_profile_id, status)
values ('a9000000-0000-4000-8000-000000000490', 'c1000000-0000-4000-8000-000000000001', 'submitted'::public.therapist_status);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);

select throws_ok(
  $$ select public.admin_execute_operation_command_v1('verification.approve', 'a9000000-0000-4000-8000-000000000490', 'Decisao administrativa valida', 'publication-no-permission') $$,
  '22023', 'verification must be in review before approval',
  'approval cannot bypass the review state'
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v1('verification.reopen_review', 'a9000000-0000-4000-8000-000000000490', 'Inicio formal da analise', 'publication-start-review') $$,
  'submitted verification enters review through the command'
);

reset role;

select is((select status::text from public.therapist_verifications where id = 'a9000000-0000-4000-8000-000000000490'), 'in_review', 'submitted transitions to in_review');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);

select lives_ok(
  $$ select public.admin_execute_operation_command_v1('verification.approve', 'a9000000-0000-4000-8000-000000000490', 'Documentacao revisada e aprovada', 'publication-approve') $$,
  'in_review verification can be approved'
);

reset role;

select is((select status::text from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'), 'approved', 'approval updates the administrative profile state');

select is((select count(*)::integer from public.admin_audit_events where request_id = 'publication-approve'), 1, 'approval writes one audit event');

select ok((public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->>'eligible')::boolean, 'approved profile with eligible service is publishable');
select ok(exists (select 1 from public.public_therapist_search where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'), 'eligible approved professional appears in public search');

update public.therapist_services set is_bookable = false where id = 'd1000000-0000-4000-8000-000000000001';
select ok(public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->'blockers' ? 'no_active_bookable_online_service', 'missing eligible service has the correct blocker');

update public.therapist_services set is_bookable = true where id = 'd1000000-0000-4000-8000-000000000001';
update public.therapies set is_public_visible = false where id = (select therapy_id from public.therapist_services where id = 'd1000000-0000-4000-8000-000000000001');
select ok(public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->'blockers' ? 'therapy_not_public', 'unpublished therapy blocks publication');

update public.therapies set is_public_visible = true where id = (select therapy_id from public.therapist_services where id = 'd1000000-0000-4000-8000-000000000001');
update public.therapist_profiles set is_public = false where id = 'c1000000-0000-4000-8000-000000000001';
select ok(public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->'blockers' ? 'profile_not_public', 'is_public false blocks publication');

update public.therapist_profiles set is_public = true, is_accepting_bookings = false where id = 'c1000000-0000-4000-8000-000000000001';
select ok(public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->'blockers' ? 'not_accepting_bookings', 'is_accepting_bookings false blocks publication');

update public.therapist_profiles set is_accepting_bookings = true where id = 'c1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);
select lives_ok($$ select public.admin_execute_operation_command_v1('professional.suspend', 'c1000000-0000-4000-8000-000000000001', 'Suspensao operacional valida', 'publication-suspend') $$, 'suspension is allowed');
reset role;
select ok(not exists (select 1 from public.public_therapist_search where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'), 'suspended professional disappears from public search');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);
select lives_ok($$ select public.admin_execute_operation_command_v1('professional.reactivate', 'c1000000-0000-4000-8000-000000000001', 'Reativacao operacional valida', 'publication-reactivate') $$, 'reactivation is allowed');
reset role;
select ok(not (public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->>'eligible')::boolean, 'reactivation keeps publication pending until public settings are explicitly restored');

select * from finish();
rollback;
