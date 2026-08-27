begin;

select plan(7);

select ok(
  to_regprocedure(
    'public.create_therapist_block_v2(uuid,uuid,text,date,time,time,boolean,text,date,uuid,text,text)'
  ) is not null,
  'the paid-conflict block command exists'
);

update public.bookings
set
  starts_at = ((current_date + 1)::date + time '10:00') at time zone 'America/Sao_Paulo',
  ends_at = ((current_date + 1)::date + time '11:00') at time zone 'America/Sao_Paulo',
  status = 'confirmed'
where id = 'f2000000-0000-4000-8000-000000000004';

update public.session_payments
set financial_status = 'paid'
where booking_id = 'f2000000-0000-4000-8000-000000000004';

set local role service_role;

create temporary table paid_block_result as
select public.create_therapist_block_v2(
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4500000-0000-4000-8000-000000000001',
  'America/Sao_Paulo',
  (current_date + 1)::date,
  null,
  null,
  true,
  'none',
  (current_date + 1)::date,
  null,
  'personal',
  'Paid conflict contract'
) as payload;

select is(
  jsonb_array_length((select payload -> 'paidImpactedBookings' from paid_block_result)),
  1,
  'confirmed paid sessions are returned as immediate conflicts'
);

select is(
  (select payload #>> '{paidImpactedBookings,0,bookingId}' from paid_block_result),
  'f2000000-0000-4000-8000-000000000004',
  'the conflict identifies the affected booking'
);

select is(
  (select payload #>> '{paidImpactedBookings,0,patientName}' from paid_block_result),
  'Paciente Juliana',
  'the conflict returns the authorized patient display name'
);

select is(
  (select payload #>> '{paidImpactedBookings,0,serviceTitle}' from paid_block_result),
  'Aromaterapia',
  'the conflict returns the therapy title'
);

select is(
  (select payload #>> '{paidImpactedBookings,0,timezone}' from paid_block_result),
  'America/Sao_Paulo',
  'the conflict returns the scheduling timezone'
);

update public.session_payments
set financial_status = 'pending'
where booking_id = 'f2000000-0000-4000-8000-000000000004';

-- Keep the unpaid assertion isolated from dynamic local fixtures while still
-- proving that an overlapping confirmed booking is excluded when unpaid.
update public.bookings
set
  starts_at = ((current_date + 3650)::date + time '10:00') at time zone 'America/Sao_Paulo',
  ends_at = ((current_date + 3650)::date + time '11:00') at time zone 'America/Sao_Paulo'
where id = 'f2000000-0000-4000-8000-000000000004';

create temporary table unpaid_block_result as
select public.create_therapist_block_v2(
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4500000-0000-4000-8000-000000000002',
  'America/Sao_Paulo',
  (current_date + 3650)::date,
  null,
  null,
  true,
  'none',
  (current_date + 3650)::date,
  null,
  'personal',
  'Unpaid conflict contract'
) as payload;

select is(
  jsonb_array_length((select payload -> 'paidImpactedBookings' from unpaid_block_result)),
  0,
  'unpaid sessions are excluded from the paid conflict alert'
);

select * from finish();
rollback;
