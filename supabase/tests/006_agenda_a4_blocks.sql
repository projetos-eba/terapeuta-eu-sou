begin;

select plan(36);

create temporary table a4_baseline as
select
  (
    select version
    from public.therapist_schedule_settings
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ) as schedule_version,
  (
    select count(*)
    from public.availability_exceptions
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ) as exception_count;

grant select on a4_baseline to service_role;

select has_table(
  'public',
  'availability_exception_series',
  'A4 stores recurrence definitions separately from materialized exceptions'
);

select has_table(
  'public',
  'availability_exception_booking_impacts',
  'A4 records booking impacts without changing bookings'
);

select has_table(
  'public',
  'availability_exception_events',
  'A4 has a sanitized audit trail'
);

select ok(
  to_regprocedure(
    'public.get_therapist_blocks_v1(timestamptz,timestamptz,text,text,text,integer,timestamptz,uuid)'
  ) is not null,
  'the versioned block read model exists'
);

select ok(
  to_regprocedure(
    'public.create_therapist_block_v1(uuid,uuid,text,date,time,time,boolean,text,date,uuid,text,text)'
  ) is not null,
  'the idempotent block create command exists'
);

select ok(
  to_regprocedure(
    'public.cancel_therapist_block_v1(uuid,uuid,uuid,text,bigint)'
  ) is not null,
  'the versioned cancellation command exists'
);

select ok(
  to_regprocedure(
    'public.resolve_therapist_block_impact_v1(uuid,uuid,uuid,text)'
  ) is not null,
  'the impact resolution command exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_blocks_v1(timestamptz,timestamptz,text,text,text,integer,timestamptz,uuid)',
    'EXECUTE'
  ),
  'authenticated therapists can execute the read model'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_therapist_block_v1(uuid,uuid,text,date,time,time,boolean,text,date,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the create command directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_therapist_block_v1(uuid,uuid,text,date,time,time,boolean,text,date,uuid,text,text)',
    'EXECUTE'
  ),
  'trusted Edge Functions can execute the command'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_blocks_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'Ana block identity is derived from auth.uid()'
);

select is(
  public.get_therapist_blocks_v1() ->> 'contractVersion',
  '1',
  'the block read model publishes contract version 1'
);

select ok(
  not exists (
    select 1
    from public.availability_exception_series
    where therapist_profile_id <> 'c1000000-0000-4000-8000-000000000001'
  ),
  'Ana reads only her own recurrence series'
);

select ok(
  (public.get_therapist_blocks_v1() #>> '{summary,pendingImpacts}')::integer > 0,
  'Ana sees seeded booking impacts requiring explicit review'
);

select ok(
  jsonb_array_length(
    public.get_therapist_blocks_v1() -> 'blocks' -> 0 -> 'impactedBookings'
  ) > 0,
  'the block read model exposes authorized related booking details'
);

select ok(
  not (
    public.get_therapist_blocks_v1()
    ?| array['actorUserId', 'requestId', 'events', 'result']
  ),
  'the read model excludes actors, idempotency keys and audit payloads'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select ok(
  not exists (
    select 1
    from public.availability_exception_series
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'Rafael cannot read Ana block series'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.availability_exception_series),
  0,
  'a patient cannot read therapist block series'
);

select throws_ok(
  'select public.get_therapist_blocks_v1()',
  '42501',
  'therapist_access_required',
  'a patient cannot invoke the therapist block read model'
);

reset role;
set local role service_role;

select is(
  (
    public.create_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000090',
      'America/Sao_Paulo',
      (current_date + 1)::date,
      null,
      null,
      true,
      'daily',
      (current_date + 3)::date,
      null,
      'vacation',
      'A4 pgTAP'
    ) ->> 'idempotentReplay'
  ),
  'false',
  'the first recurring create command applies the change'
);

select is(
  (
    select count(*)::integer
    from public.availability_exceptions as exception
    join public.availability_exception_series as series
      on series.id = exception.series_id
    where series.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and series.reason = 'A4 pgTAP'
  ),
  3,
  'daily recurrence materializes exactly one interval per local date'
);

select is(
  (
    select min(
      (exception.starts_at at time zone exception.timezone)::date
    )
    from public.availability_exceptions as exception
    join public.availability_exception_series as series
      on series.id = exception.series_id
    where series.reason = 'A4 pgTAP'
  ),
  (current_date + 1)::date,
  'materialized UTC instants preserve the requested business date'
);

select ok(
  (
    select count(*)
    from public.availability_exception_booking_impacts as impact
    join public.availability_exceptions as exception
      on exception.id = impact.exception_id
    join public.availability_exception_series as series
      on series.id = exception.series_id
    where series.reason = 'A4 pgTAP'
  ) > 0,
  'the command detects existing bookings overlapping generated blocks'
);

select is(
  (
    select status::text
    from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000004'
  ),
  'confirmed',
  'creating a block does not silently change an existing booking'
);

select is(
  (
    select version
    from public.therapist_schedule_settings
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  (select schedule_version + 1 from a4_baseline),
  'a successful block command increments the shared schedule version'
);

select is(
  (
    select count(*)::integer
    from public.availability_exception_events
    where request_id = 'a4000000-0000-4000-8000-000000000090'
  ),
  1,
  'the command records one sanitized audit event'
);

select is(
  (
    public.create_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000090',
      'America/Sao_Paulo',
      (current_date + 1)::date,
      null,
      null,
      true,
      'daily',
      (current_date + 3)::date,
      null,
      'vacation',
      'A4 pgTAP'
    ) ->> 'idempotentReplay'
  ),
  'true',
  'repeating the same request returns an idempotent replay'
);

select is(
  (
    select count(*)::integer
    from public.availability_exceptions as exception
    join public.availability_exception_series as series
      on series.id = exception.series_id
    where series.reason = 'A4 pgTAP'
  ),
  3,
  'idempotent replay does not duplicate materialized occurrences'
);

select is(
  (
    select count(*)::integer
    from public.availability_exception_events
    where request_id = 'a4000000-0000-4000-8000-000000000090'
  ),
  1,
  'idempotent replay does not duplicate audit events'
);

select throws_ok(
  $$
    select public.cancel_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000091',
      (
        select exception.id
        from public.availability_exceptions as exception
        join public.availability_exception_series as series
          on series.id = exception.series_id
        where series.reason = 'A4 pgTAP'
        order by exception.starts_at
        limit 1
      ),
      'occurrence',
      1
    )
  $$,
  '40001',
  'schedule_version_conflict',
  'stale cancellation versions are rejected'
);

select is(
  (
    public.resolve_therapist_block_impact_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000092',
      (
        select impact.id
        from public.availability_exception_booking_impacts as impact
        join public.availability_exceptions as exception
          on exception.id = impact.exception_id
        join public.availability_exception_series as series
          on series.id = exception.series_id
        where series.reason = 'A4 pgTAP'
        order by impact.created_at
        limit 1
      ),
      'keep_booking'
    ) ->> 'status'
  ),
  'resolved',
  'the therapist can explicitly keep an impacted booking'
);

select is(
  (
    public.cancel_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000093',
      (
        select exception.id
        from public.availability_exceptions as exception
        join public.availability_exception_series as series
          on series.id = exception.series_id
        where series.reason = 'A4 pgTAP'
        order by exception.starts_at
        limit 1
      ),
      'occurrence',
      (
        select version
        from public.therapist_schedule_settings
        where therapist_profile_id =
          'c1000000-0000-4000-8000-000000000001'
      )
    ) ->> 'cancelledCount'
  ),
  '1',
  'one occurrence can be cancelled independently'
);

select is(
  (
    select count(*)::integer
    from public.availability_exceptions as exception
    join public.availability_exception_series as series
      on series.id = exception.series_id
    where series.reason = 'A4 pgTAP'
      and exception.status = 'cancelled'
  ),
  1,
  'occurrence cancellation preserves the remaining series'
);

select is(
  (
    public.cancel_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000094',
      (
        select exception.id
        from public.availability_exceptions as exception
        join public.availability_exception_series as series
          on series.id = exception.series_id
        where series.reason = 'A4 pgTAP'
          and exception.status = 'active'
        order by exception.starts_at
        limit 1
      ),
      'series',
      (
        select version
        from public.therapist_schedule_settings
        where therapist_profile_id =
          'c1000000-0000-4000-8000-000000000001'
      )
    ) ->> 'cancelledCount'
  ),
  '2',
  'the remaining recurrence series can be cancelled atomically'
);

select is(
  (
    select status
    from public.availability_exception_series
    where reason = 'A4 pgTAP'
  ),
  'cancelled',
  'series cancellation preserves history with a cancelled status'
);

update public.therapist_profiles
set status = 'suspended'
where id = 'c1000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select public.create_therapist_block_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000095',
      'America/Sao_Paulo',
      (current_date + 10)::date,
      null,
      null,
      true,
      'none',
      (current_date + 10)::date,
      null,
      'personal',
      null
    )
  $$,
  '42501',
  'therapist_access_blocked',
  'a suspended therapist cannot create blocks'
);

select * from finish();
rollback;
