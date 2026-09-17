begin;

select plan(22);

create temporary table schedule_reapproval_baseline as
select
  schedule.version as schedule_version,
  (select count(*)::integer
   from public.availability_rules rule
   where rule.therapist_profile_id = therapist.id
     and rule.is_active) as active_rule_count,
  (select count(*)::integer
   from public.bookings booking
   where booking.therapist_profile_id = therapist.id) as booking_count
from public.therapist_profiles therapist
join public.therapist_schedule_settings schedule
  on schedule.therapist_profile_id = therapist.id
where therapist.id = 'c1000000-0000-4000-8000-000000000001';

grant select on schedule_reapproval_baseline to service_role;

update public.therapist_connect_accounts
set is_current = false,
    disabled_reason = coalesce(disabled_reason, 'test_replaced'),
    updated_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and is_current;

update public.therapist_profiles
set status = 'approved',
    public_status = 'published',
    is_public = true,
    is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_schedule_v1() ->> 'contractVersion',
  '2',
  'schedule read model uses the completion-aware contract'
);

select ok(
  (public.get_therapist_schedule_v1() ->> 'activeRuleCount')::integer > 0,
  'schedule read model exposes the global active-rule count'
);

select is(
  public.get_therapist_schedule_v1() ->> 'isPubliclyVisible',
  'true',
  'schedule read model reflects the stored public state used by withdrawal'
);

reset role;

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, account_generation,
  onboarding_status, details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, payout_status, payout_schedule_interval,
  operational_status
) values (
  'f9500000-0000-4000-8000-000000000010',
  'c1000000-0000-4000-8000-000000000001',
  'acct_schedule_reapproval_test', 950,
  'ready', true, false, true,
  'active', 'enabled', 'daily', 'ready'
);

set local role service_role;

select is(
  public.save_therapist_schedule_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select schedule_version from schedule_reapproval_baseline),
    'America/Sao_Paulo',
    '[]'::jsonb,
    '[]'::jsonb,
    'f9500000-0000-4000-8000-000000000001'
  ) ->> 'publicationImpact',
  'reapproval_required',
  'removing the final active availability reports the reapproval impact'
);

select is(
  (select status::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  'submitted',
  'the public therapist returns to submitted status'
);

select is(
  (select public_status::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  'unpublished',
  'the profile is withdrawn from public publication'
);

select ok(
  not (select is_public from public.therapist_profiles
       where id = 'c1000000-0000-4000-8000-000000000001'),
  'the public visibility switch is disabled'
);

select is(
  (select review_origin
   from public.therapist_verifications
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
   order by submitted_at desc, created_at desc
   limit 1),
  'availability_removed',
  'a fresh review records the schedule-removal origin'
);

select ok(
  (select source_schedule_event_id is not null
   from public.therapist_verifications
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
   order by submitted_at desc, created_at desc
   limit 1),
  'the review is linked to the authoritative schedule event'
);

select is(
  (select previous_active_rule_count
   from public.therapist_schedule_events
   where request_id = 'f9500000-0000-4000-8000-000000000001'),
  (select active_rule_count from schedule_reapproval_baseline),
  'the event records the previous active availability count'
);

select is(
  (select active_rule_count
   from public.therapist_schedule_events
   where request_id = 'f9500000-0000-4000-8000-000000000001'),
  0,
  'the event records the resulting empty schedule'
);

select ok(
  exists (
    select 1
    from public.notifications notification
    where notification.profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and notification.event_key like 'availability-removed:%'
  ),
  'the therapist receives one actionable notification'
);

select is(
  (select count(*)::integer
   from public.bookings booking
   where booking.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  (select booking_count from schedule_reapproval_baseline),
  'existing bookings are preserved'
);

select is(
  public.save_therapist_schedule_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select schedule_version from schedule_reapproval_baseline),
    'America/Sao_Paulo',
    '[]'::jsonb,
    '[]'::jsonb,
    'f9500000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay',
  'true',
  'replaying the same removal request is idempotent'
);

select is(
  (select count(*)::integer
   from public.therapist_verifications
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
     and review_origin = 'availability_removed'),
  1,
  'the idempotent replay does not duplicate the review'
);

update public.therapist_verifications
set status = 'in_review'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and review_origin = 'availability_removed';

select throws_ok(
  $$
    update public.therapist_verifications
    set status = 'approved'
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and review_origin = 'availability_removed'
  $$,
  '22023',
  'THERAPIST_PROFILE_INCOMPLETE',
  'an incomplete profile cannot be approved'
);

select ok(
  (public.get_therapist_publication_eligibility_v1(
    'c1000000-0000-4000-8000-000000000001'
  ) -> 'blockers') ? 'no_active_availability',
  'publication eligibility explains the missing schedule'
);

update public.therapist_profiles
set status = 'approved'
where id = 'c1000000-0000-4000-8000-000000000001';

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.admin_execute_operation_command_v2(
    'professional.publish',
    'c1000000-0000-4000-8000-000000000001',
    'Tentativa sem agenda completa',
    'schedule-reapproval-publish-blocked-135'
  ) $$,
  '22023',
  'profile does not meet the publication criteria',
  'administrative publication is blocked while availability is empty'
);

reset role;
set local role service_role;

update public.profiles
set role = 'therapist'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

update public.therapist_profiles
set status = 'submitted'
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  public.save_therapist_schedule_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select schedule_version + 1 from schedule_reapproval_baseline),
    'America/Sao_Paulo',
    jsonb_build_array(jsonb_build_object(
      'id', null,
      'serviceId', 'd1000000-0000-4000-8000-000000000001',
      'dayOfWeek', 1,
      'startTime', '09:00',
      'endTime', '12:00',
      'isActive', true
    )),
    '[]'::jsonb,
    'f9500000-0000-4000-8000-000000000002'
  ) ->> 'publicationImpact',
  'none',
  'restoring availability does not republish automatically'
);

select is(
  (select status::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  'submitted',
  'the therapist remains in review after restoring availability'
);

update public.therapist_verifications
set status = 'approved'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and review_origin = 'availability_removed';

select ok(
  (public.get_therapist_publication_eligibility_v1(
    'c1000000-0000-4000-8000-000000000001'
  ) ->> 'eligible')::boolean,
  'approval restores publication only after the schedule is complete again'
);

select is(
  (select count(*)::integer
   from public.therapist_profile_events
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
     and event_type = 'availability_removed'
     and request_id = 'f9500000-0000-4000-8000-000000000001'),
  1,
  'the withdrawal has one immutable profile audit event'
);

select * from finish();

rollback;
