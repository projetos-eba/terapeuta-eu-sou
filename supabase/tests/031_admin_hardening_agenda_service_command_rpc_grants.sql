begin;

select plan(35);

with expectations(role_name, function_signature, expected, message) as (
  values
    (
      'anon',
      'public.validate_booking_against_active_holds_v1()',
      false,
      'anon cannot execute booking/hold trigger helper'
    ),
    (
      'authenticated',
      'public.validate_booking_against_active_holds_v1()',
      false,
      'authenticated cannot execute booking/hold trigger helper'
    ),
    (
      'service_role',
      'public.validate_booking_against_active_holds_v1()',
      false,
      'service_role cannot execute booking/hold trigger helper directly'
    ),
    (
      'anon',
      'public.validate_hold_against_active_bookings_v1()',
      false,
      'anon cannot execute hold/booking trigger helper'
    ),
    (
      'authenticated',
      'public.validate_hold_against_active_bookings_v1()',
      false,
      'authenticated cannot execute hold/booking trigger helper'
    ),
    (
      'service_role',
      'public.validate_hold_against_active_bookings_v1()',
      false,
      'service_role cannot execute hold/booking trigger helper directly'
    ),
    (
      'anon',
      'public.transition_booking_status_v1(uuid,public.booking_status,uuid,text,text,integer,text)',
      false,
      'anon cannot transition bookings directly'
    ),
    (
      'authenticated',
      'public.transition_booking_status_v1(uuid,public.booking_status,uuid,text,text,integer,text)',
      false,
      'authenticated cannot transition bookings directly'
    ),
    (
      'service_role',
      'public.transition_booking_status_v1(uuid,public.booking_status,uuid,text,text,integer,text)',
      true,
      'service_role can transition bookings through trusted command boundaries'
    ),
    (
      'anon',
      'public.list_private_therapist_services_v1(uuid)',
      false,
      'anon cannot list private therapist services directly'
    ),
    (
      'authenticated',
      'public.list_private_therapist_services_v1(uuid)',
      false,
      'authenticated cannot list private therapist services directly'
    ),
    (
      'service_role',
      'public.list_private_therapist_services_v1(uuid)',
      true,
      'service_role can list private therapist services through the Edge boundary'
    ),
    (
      'anon',
      'public.create_therapist_service_v1(uuid,uuid,jsonb)',
      false,
      'anon cannot create therapist services directly'
    ),
    (
      'authenticated',
      'public.create_therapist_service_v1(uuid,uuid,jsonb)',
      false,
      'authenticated cannot create therapist services directly'
    ),
    (
      'service_role',
      'public.create_therapist_service_v1(uuid,uuid,jsonb)',
      true,
      'service_role can create therapist services through the Edge boundary'
    ),
    (
      'anon',
      'public.update_therapist_service_v1(uuid,uuid,uuid,bigint,jsonb)',
      false,
      'anon cannot update therapist services directly'
    ),
    (
      'authenticated',
      'public.update_therapist_service_v1(uuid,uuid,uuid,bigint,jsonb)',
      false,
      'authenticated cannot update therapist services directly'
    ),
    (
      'service_role',
      'public.update_therapist_service_v1(uuid,uuid,uuid,bigint,jsonb)',
      true,
      'service_role can update therapist services through the Edge boundary'
    ),
    (
      'anon',
      'public.transition_therapist_service_v1(uuid,uuid,uuid,bigint,text)',
      false,
      'anon cannot transition therapist services directly'
    ),
    (
      'authenticated',
      'public.transition_therapist_service_v1(uuid,uuid,uuid,bigint,text)',
      false,
      'authenticated cannot transition therapist services directly'
    ),
    (
      'service_role',
      'public.transition_therapist_service_v1(uuid,uuid,uuid,bigint,text)',
      true,
      'service_role can transition therapist services through the Edge boundary'
    ),
    (
      'anon',
      'public.reorder_therapist_services_v1(uuid,uuid,uuid[])',
      false,
      'anon cannot reorder therapist services directly'
    ),
    (
      'authenticated',
      'public.reorder_therapist_services_v1(uuid,uuid,uuid[])',
      false,
      'authenticated cannot reorder therapist services directly'
    ),
    (
      'service_role',
      'public.reorder_therapist_services_v1(uuid,uuid,uuid[])',
      true,
      'service_role can reorder therapist services through the Edge boundary'
    ),
    (
      'anon',
      'public.replace_therapist_service_matching_v1(uuid,uuid,uuid[],uuid[],uuid)',
      false,
      'anon cannot replace therapist service Match data directly'
    ),
    (
      'authenticated',
      'public.replace_therapist_service_matching_v1(uuid,uuid,uuid[],uuid[],uuid)',
      false,
      'authenticated cannot replace therapist service Match data directly'
    ),
    (
      'service_role',
      'public.replace_therapist_service_matching_v1(uuid,uuid,uuid[],uuid[],uuid)',
      true,
      'service_role can replace therapist service Match data through trusted commands'
    ),
    (
      'anon',
      'public.create_therapist_service_with_matching_v1(uuid,uuid,jsonb)',
      false,
      'anon cannot create therapist services with Match data directly'
    ),
    (
      'authenticated',
      'public.create_therapist_service_with_matching_v1(uuid,uuid,jsonb)',
      false,
      'authenticated cannot create therapist services with Match data directly'
    ),
    (
      'service_role',
      'public.create_therapist_service_with_matching_v1(uuid,uuid,jsonb)',
      true,
      'service_role can create therapist services with Match data through trusted commands'
    ),
    (
      'anon',
      'public.update_therapist_service_with_matching_v1(uuid,uuid,uuid,bigint,jsonb)',
      false,
      'anon cannot update therapist services with Match data directly'
    ),
    (
      'authenticated',
      'public.update_therapist_service_with_matching_v1(uuid,uuid,uuid,bigint,jsonb)',
      false,
      'authenticated cannot update therapist services with Match data directly'
    ),
    (
      'service_role',
      'public.update_therapist_service_with_matching_v1(uuid,uuid,uuid,bigint,jsonb)',
      true,
      'service_role can update therapist services with Match data through trusted commands'
    )
)
select is(
  has_function_privilege(role_name, function_signature, 'EXECUTE'),
  expected,
  message
)
from expectations;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.transition_booking_status_v1(
      '00000000-0000-4000-8000-000000000001'::uuid,
      'cancelled_by_patient'::public.booking_status,
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      'hardening test',
      'hardening-test-booking-status',
      null,
      'hardening_test'
    )
  $$,
  '42501',
  null,
  'authenticated direct booking transition call is denied before business logic'
);

select throws_ok(
  $$
    select public.update_therapist_service_with_matching_v1(
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000002'::uuid,
      '00000000-0000-4000-8000-000000000003'::uuid,
      1::bigint,
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'authenticated direct therapist service update with Match data is denied before business logic'
);

reset role;

select * from finish();

rollback;
