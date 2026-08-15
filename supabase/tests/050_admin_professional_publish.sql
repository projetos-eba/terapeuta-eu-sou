begin;

select plan(8);

select ok(
  to_regprocedure('public.admin_execute_professional_lifecycle_command_v1(text,uuid,text,text,jsonb,text)') is not null,
  'professional lifecycle command supports administrative publication'
);

update public.therapist_profiles
set
  status = 'approved'::public.therapist_status,
  public_status = 'unpublished',
  is_public = false,
  is_accepting_bookings = false,
  accepts_online_sessions = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set status = 'active', is_bookable = true, online_only = true, archived_at = null
where id = 'd1000000-0000-4000-8000-000000000001';

update public.therapies
set status = 'published', is_public_visible = true
where id = (select therapy_id from public.therapist_services where id = 'd1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2('professional.publish', 'c1000000-0000-4000-8000-000000000001', 'Perfil revisado e pronto para publicação.', 'professional-publish-1') $$,
  'admin can publish an approved profile that only needs public switches'
);

reset role;

select ok(
  (public.get_therapist_publication_eligibility_v1('c1000000-0000-4000-8000-000000000001')->>'eligible')::boolean,
  'published profile is eligible for the public surfaces'
);

select ok(
  exists (select 1 from public.public_therapist_search where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  'published profile appears in the public therapist search'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}', true);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2('professional.publish', 'c1000000-0000-4000-8000-000000000001', 'Perfil revisado e pronto para publicação.', 'professional-publish-1') $$,
  'replaying publication with the same request id is safe'
);

select is(
  (select count(*)::integer from public.admin_audit_events where request_id = 'professional-publish-1' and action = 'professional.publish'),
  1,
  'publication writes exactly one audit event'
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2('professional.suspend', 'c1000000-0000-4000-8000-000000000001', 'Suspensão operacional validada.', 'professional-publish-suspend') $$,
  'suspension remains available after publication'
);

select throws_ok(
  $$ select public.admin_execute_operation_command_v2('professional.publish', 'c1000000-0000-4000-8000-000000000001', 'Tentativa após suspensão válida.', 'professional-publish-suspended') $$,
  '22023', 'only approved non-suspended professionals can be published',
  'publication cannot reactivate a suspended professional'
);

select * from finish();
rollback;
