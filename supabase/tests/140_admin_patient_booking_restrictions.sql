begin;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.patient_booking_restrictions'::regclass), 'restrictions have RLS');
select ok(not has_table_privilege('authenticated','public.patient_booking_restrictions','SELECT'), 'patients cannot read the restriction table');
select ok(not has_table_privilege('authenticated','public.patient_booking_restrictions','UPDATE'), 'patients cannot reactivate themselves');
select ok(not has_table_privilege('service_role','public.patient_booking_restrictions','UPDATE'), 'state transitions require the audited command');
select ok(not has_function_privilege('anon','public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text)','EXECUTE'), 'anonymous commands are denied');
select ok(not has_function_privilege('authenticated','public.admin_get_operation_detail_v1_before_patient_restrictions(text,uuid)','EXECUTE'), 'the compatibility detail reader is private');

-- More than fifty isolated clients; all fixture writes roll back.
insert into auth.users (id,email) select
  ('a1400000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  'admin-client-fixture-' || i || '@example.test'
from generate_series(1,60) i;
insert into public.profiles (id,role,display_name,email) select
  id,'patient','ADM Fixture ' || row_number() over (order by id),email from auth.users
where id::text like 'a1400000-%';
insert into public.patient_profiles (id,user_id,display_name,created_at) select
  ('b1400000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  ('a1400000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  'ADM Fixture ' || lpad(i::text,3,'0'),
  now()-case when i<=20 then interval '5 days' when i<=59 then interval '35 days' else interval '61 days' end
from generate_series(1,60) i;
update public.patient_profiles set phone='11987654321',phone_country_code='55',
  metadata='{"account":{"address":{"postalCode":"01001000","street":"Praça da Sé","streetNumber":"10","city":"São Paulo","state":"SP"}},"private_marker":"must-not-leak"}'::jsonb
where id='b1400000-0000-4000-8000-000000000060';
update public.patient_profiles set phone='2071234567',phone_country_code=null
where id='b1400000-0000-4000-8000-000000000058';
update public.profiles set phone_country_code='44'
where id='a1400000-0000-4000-8000-000000000058';

set local role authenticated;
select set_config('request.jwt.claim.sub','a1400000-0000-4000-8000-000000000060',true);
select throws_ok($$select public.admin_get_operation_module_v2('patients')$$,'42501','admin permission required','a patient cannot read the admin client list');
select throws_ok($$select public.admin_get_operation_detail_v1('patients','b1400000-0000-4000-8000-000000000060')$$,'42501','admin permission required','a patient cannot read private admin details');
select throws_ok($$select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000060','Motivo válido de teste','patient-denied-140')$$,'42501','admin permission required','non-admin suspension is denied');
reset role;

-- Prepare existing contracts without changing the public slot engine.
alter table public.booking_holds disable trigger validate_booking_hold_schedule;
insert into public.bookings (id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status)
values ('e1400000-0000-4000-8000-000000000001','b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-01 10:00Z','2099-05-01 10:50Z','America/Sao_Paulo','draft','not_started');
insert into public.booking_holds (id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,idempotency_key,expires_at,consume_idempotency_key,consumed_booking_id)
values
('a1400000-0000-4000-8000-000000000011','b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-02 10:00Z','2099-05-02 10:50Z','America/Sao_Paulo','active','client-active-hold-140','2099-12-31 10:00Z',null,null),
('a1400000-0000-4000-8000-000000000012','b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-01 10:00Z','2099-05-01 10:50Z','America/Sao_Paulo','consumed','client-consumed-hold-140','2099-12-31 10:00Z','client-consume-retry-140','e1400000-0000-4000-8000-000000000001');
create temp table existing_contract_140 as select to_jsonb(b) as payload from public.bookings b where id='e1400000-0000-4000-8000-000000000001';
create temp table existing_auth_140 as select to_jsonb(u) as payload from auth.users u where id='a1400000-0000-4000-8000-000000000060';

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000090',true);
select throws_ok($$select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000060','short','client-short-reason-140')$$,'22023','admin command reason invalid','reason is required in the database too');
create temp table metrics_before_140 as select public.admin_get_operation_module_v2('patients')->'metrics' as payload;
create temp table first_suspend_140 as select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000060','Motivo administrativo válido','client-suspend-request-140') as payload;
select is(public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000060','Motivo administrativo válido','client-suspend-request-140'),(select payload from first_suspend_140),'retries return the exact audited result');
select throws_ok($$select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000059','Motivo administrativo válido','client-suspend-request-140')$$,'22023','IDEMPOTENCY_KEY_REUSED','request reuse across targets is rejected');
select throws_ok($$select public.admin_execute_operation_command_v2('patient.reactivate','b1400000-0000-4000-8000-000000000060','Motivo administrativo válido','client-suspend-request-140')$$,'22023','IDEMPOTENCY_KEY_REUSED','request reuse across actions is rejected');
create temp table suspended_list_140 as select public.admin_get_operation_module_v2('patients','{"status":"suspended","search":"ADM Fixture 060"}') as payload;
select is((select payload #>> '{page,total}' from suspended_list_140),'1','the suspended filter reaches a client beyond the original fifty-record window');
select is((select payload #>> '{rows,0,account_status}' from suspended_list_140),'suspended','the list exposes authoritative suspension state');
select is((public.admin_get_operation_module_v2('patients','{"search":"ADM Fixture","page":5,"pageSize":12}')->'rows')::jsonb->>0 is not null,true,'pagination reaches clients beyond fifty');
select is((public.admin_get_operation_module_v2('patients','{"search":"ADM Fixture"}') #>> '{page,total}'),'60','search totals cover the entire matching base');
select is((select (payload #>> '{metrics,active-patients}')::integer from suspended_list_140),(select (payload->>'active-patients')::integer-1 from metrics_before_140),'active count decreases globally');
select is((select (payload #>> '{metrics,suspended-patients}')::integer from suspended_list_140),(select (payload->>'suspended-patients')::integer+1 from metrics_before_140),'suspended count increases globally');
select is((select (payload #>> '{metrics,active-patients-percentage}')::numeric from suspended_list_140),(select round(100.0*(payload #>> '{metrics,active-patients}')::numeric/(payload #>> '{metrics,total-patients}')::numeric,1) from suspended_list_140),'active percentage uses the complete base rather than the filtered count');
select is((select payload #>> '{metrics,total-patients}' from suspended_list_140),(select payload->>'total-patients' from metrics_before_140),'total count is independent of filters');
select is((select payload #>> '{metrics,previous-patients}' from suspended_list_140),(select payload->>'previous-patients' from metrics_before_140),'comparison counts are independent of filters');
create temp table patient_detail_140 as select public.admin_get_operation_detail_v1('patients','b1400000-0000-4000-8000-000000000060') as payload;
select is((select payload #>> '{record,booking_management_available}' from patient_detail_140),'true','the new server contract explicitly enables administrative booking management');
select is((select payload #>> '{record,private_contact,email}' from patient_detail_140),'admin-client-fixture-60@example.test','email comes from the linked account');
select is((select payload #>> '{record,private_contact,phone}' from patient_detail_140),'11987654321','contact comes from the patient registration');
select is(public.admin_get_operation_detail_v1('patients','b1400000-0000-4000-8000-000000000058') #>> '{record,private_contact,phoneCountryCode}',null::text,'missing patient DDI is not inferred from another profile or a default');
select is((select payload #>> '{record,private_contact,postalCode}' from patient_detail_140),'01001000','address comes from the canonical account metadata');
select ok((select payload::text not like '%must-not-leak%' from patient_detail_140),'raw metadata is never projected');
select is((select payload #>> '{rows,0,email}' from suspended_list_140),'admin-client-fixture-60@example.test','list projects the allowlisted account email for administrative contact');
select is((select payload #>> '{rows,0,phone}' from suspended_list_140),'11987654321','list projects the allowlisted registration phone for administrative contact');
select is((select payload #>> '{rows,0,phone_country_code}' from suspended_list_140),'55','list projects the registration DDI without account metadata');
select ok((select payload::text not like '%must-not-leak%' from suspended_list_140),'list payload keeps raw metadata private');
select is((public.admin_get_operation_module_v2('patients') #>> '{patientAnalytics,periodDays}'),'30','client analytics defaults to the last 30 complete calendar days');
select is(jsonb_array_length(public.admin_get_operation_module_v2('patients')->'patientAnalytics'->'series'),30,'client growth returns one global aggregate per day in the selected period');
select is((public.admin_get_operation_module_v2('patients','{"analyticsPeriod":90}') #>> '{patientAnalytics,periodDays}'),'90','client analytics accepts the 90-day period');
select is(jsonb_array_length(public.admin_get_operation_module_v2('patients','{"analyticsPeriod":90}')->'patientAnalytics'->'series'),90,'client growth returns ninety global daily aggregates for the selected period');
select is((public.admin_get_operation_module_v2('patients') #>> '{patientAnalytics,series,29,totalClients}')::integer,(select count(*)::integer from public.patient_profiles),'client growth cumulative total uses the full client base');
reset role;
select is((select count(*)::integer from public.admin_audit_events where source='admin-patient-booking-command' and request_id='client-suspend-request-140'),1,'suspension has a single audit event');
select is((public.admin_get_operation_module_v2('patients') #>> '{metrics,recent-patients}')::integer,(select count(*)::integer from public.patient_profiles where created_at>=now()-interval '30 days'),'recent registrations use the full rolling period');
select is((public.admin_get_operation_module_v2('patients') #>> '{metrics,previous-patients}')::integer,(select count(*)::integer from public.patient_profiles where created_at>=now()-interval '60 days' and created_at<now()-interval '30 days'),'comparison uses the preceding non-overlapping period');
select is((select to_jsonb(b) from public.bookings b where id='e1400000-0000-4000-8000-000000000001'),(select payload from existing_contract_140),'suspension does not mutate contracts or payments');
select is((select to_jsonb(u) from auth.users u where id='a1400000-0000-4000-8000-000000000060'),(select payload from existing_auth_140),'Auth/login state is untouched');
select throws_ok($$insert into public.booking_holds (patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,idempotency_key,expires_at) values ('b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-03 10:00Z','2099-05-03 10:50Z','America/Sao_Paulo','client-blocked-hold-140','2099-12-31 10:00Z')$$,'P0001','PATIENT_BOOKING_SUSPENDED','new holds are blocked in the database');
select throws_ok($$insert into public.bookings (patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status) values ('b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-03 10:00Z','2099-05-03 10:50Z','America/Sao_Paulo','draft','not_started')$$,'P0001','PATIENT_BOOKING_SUSPENDED','new bookings are blocked in the database');
-- A held slot is not an existing contract. Conversion must fail atomically.
select throws_ok($$select public.consume_booking_hold_v1('a1400000-0000-4000-8000-000000000011','client-active-consume-140')$$,'P0001','PATIENT_BOOKING_SUSPENDED','an unconsumed checkout cannot become a new booking after suspension');
select is((select status::text from public.booking_holds where id='a1400000-0000-4000-8000-000000000011'),'active','failed conversion rolls back its intermediate hold mutation');
-- Exact consumed retries never insert a new booking and remain permitted.
select is((public.consume_booking_hold_v1('a1400000-0000-4000-8000-000000000012','client-consume-retry-140')).id,'e1400000-0000-4000-8000-000000000001'::uuid,'consumed hold retries keep the existing booking');
select lives_ok($$update public.bookings set starts_at='2099-05-04 10:00Z',ends_at='2099-05-04 10:50Z' where id='e1400000-0000-4000-8000-000000000001'$$,'existing bookings can be rescheduled');
set local role authenticated;
select is(public.admin_execute_operation_command_v2('patient.reactivate','b1400000-0000-4000-8000-000000000060','Reativação administrativa válida','client-reactivate-request-140') #>> '{nextState,accountStatus}','active','reactivation is audited and authoritative');
reset role;
select lives_ok($$insert into public.bookings (patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status) values ('b1400000-0000-4000-8000-000000000060','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','2099-05-05 10:00Z','2099-05-05 10:50Z','America/Sao_Paulo','draft','not_started')$$,'reactivation allows new bookings again');
update public.profiles set auth_deleted_at=now() where id='a1400000-0000-4000-8000-000000000059';
select throws_ok($$select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000059','Motivo administrativo válido','client-deleted-request-140')$$,'P0002','active patient target not found','deleted accounts cannot be suspended');
update public.profiles set anonymized_at=now() where id='a1400000-0000-4000-8000-000000000058';
select throws_ok($$select public.admin_execute_operation_command_v2('patient.suspend','b1400000-0000-4000-8000-000000000058','Motivo administrativo válido','client-anonymized-request-140')$$,'P0002','active patient target not found','anonymized accounts cannot be suspended');

-- Cross-connection lock checks run in 140_patient_booking_restriction_concurrency.ps1
-- without dblink, passwords, committed fixtures or changes to database roles.
alter table public.booking_holds enable trigger validate_booking_hold_schedule;
select * from finish();
rollback;
