begin;

select plan(17);

select set_config('tes.suppress_therapist_lifecycle_email', 'true', true);

create temporary table verification_queue_baseline as
select
  therapist.id as therapist_profile_id,
  count(verification.id)::integer as history_count
from public.therapist_profiles as therapist
left join public.therapist_verifications as verification
  on verification.therapist_profile_id = therapist.id
where therapist.id in (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002'
)
group by therapist.id;

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status,
  review_origin,
  submitted_at,
  reviewed_at,
  created_at,
  updated_at
) values
  (
    'fa100000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'approved',
    'profile_submission',
    '2099-01-01 12:00:00+00',
    '2099-01-01 13:00:00+00',
    '2099-01-01 12:00:00+00',
    '2099-01-01 13:00:00+00'
  ),
  (
    'fa100000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'submitted',
    'availability_removed',
    '2099-01-02 12:00:00+00',
    null,
    '2099-01-02 12:00:00+00',
    '2099-01-02 12:00:00+00'
  ),
  (
    'fa200000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000002',
    'approved',
    'profile_submission',
    '2099-01-03 12:00:00+00',
    '2099-01-03 13:00:00+00',
    '2099-01-03 12:00:00+00',
    '2099-01-03 13:00:00+00'
  ),
  (
    'fa200000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    'submitted',
    'connect_account_closed',
    '2099-01-04 12:00:00+00',
    null,
    '2099-01-04 12:00:00+00',
    '2099-01-04 12:00:00+00'
  );

update public.profiles
set role = 'admin'::public.user_role
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  1,
  'the v1 queue shows the schedule reapproval therapist once'
);

select is(
  (
    select row_payload ->> 'id'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  'fa100000-0000-4000-8000-000000000002',
  'the v1 queue keeps the current schedule reapproval'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000002'
  ),
  1,
  'the v1 queue shows the receiving-account reapproval therapist once'
);

select is(
  (
    select row_payload ->> 'id'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000002'
  ),
  'fa200000-0000-4000-8000-000000000002',
  'the v1 queue keeps the current receiving-account reapproval'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v2(
        'verifications',
        '{"page":1,"pageSize":50}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' in (
      'c1000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000002'
    )
  ),
  2,
  'the paginated queue returns one current row for each therapist'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v2(
        'verifications',
        '{"page":1,"pageSize":50,"status":"approved"}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' in (
      'c1000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000002'
    )
  ),
  0,
  'status filters do not revive historical approvals in the queue'
);

select is(
  (
    public.admin_get_operation_module_v1('verifications', 50, 0)
      -> 'metrics'
      ->> 'total-verifications'
  )::integer,
  (
    select count(distinct therapist_profile_id)::integer
    from public.therapist_verifications
  ),
  'the total metric counts current therapist entries instead of review history'
);

select is(
  (
    public.admin_get_operation_module_v1('verifications', 50, 0)
      -> 'metrics'
      ->> 'pending-verifications'
  )::integer,
  (
    select count(*)::integer
    from (
      select distinct on (verification.therapist_profile_id)
        verification.status
      from public.therapist_verifications as verification
      order by
        verification.therapist_profile_id,
        verification.submitted_at desc nulls last,
        verification.created_at desc,
        verification.id desc
    ) as current_verification
    where current_verification.status in (
      'submitted'::public.therapist_status,
      'in_review'::public.therapist_status,
      'changes_requested'::public.therapist_status
    )
  ),
  'the pending metric reflects only each therapist current review'
);

select is(
  (
    select count(*)::integer
    from public.therapist_verifications as verification
    where verification.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
  ),
  (
    select history_count + 2
    from verification_queue_baseline
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
  ),
  'deduplicating the queue preserves the complete review history'
);

select is(
  public.admin_get_operation_detail_v1(
    'verifications',
    'fa100000-0000-4000-8000-000000000001'
  ) -> 'record' ->> 'id',
  'fa100000-0000-4000-8000-000000000001',
  'a historical review remains available to the detail read model'
);

select is(
  (
    select row_payload ->> 'therapist_email'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  (
    select profile.email
    from public.therapist_profiles as therapist
    join public.profiles as profile on profile.id = therapist.user_id
    where therapist.id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'the v1 queue includes the allowlisted professional email'
);

select is(
  (
    select row_payload ->> 'therapist_profile_id'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  'c1000000-0000-4000-8000-000000000001',
  'the v1 queue retains the therapist identifier used by the review'
);

select ok(
  (
    select nullif(row_payload ->> 'therapist_created_at', '') is not null
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('verifications', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  'the v1 queue includes the therapist registration date'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v2(
        'verifications',
        jsonb_build_object(
          'page', 1,
          'pageSize', 50,
          'search', (
            select profile.email
            from public.therapist_profiles as therapist
            join public.profiles as profile on profile.id = therapist.user_id
            where therapist.id = 'c1000000-0000-4000-8000-000000000001'
          )
        )
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'therapist_profile_id' =
      'c1000000-0000-4000-8000-000000000001'
  ),
  1,
  'the paginated queue can find a verification by professional email'
);

select is(
  public.admin_get_operation_detail_v1(
    'verifications',
    'fa100000-0000-4000-8000-000000000001'
  ) -> 'record' -> 'admin_verification_professional' ->> 'email',
  (
    select profile.email
    from public.therapist_profiles as therapist
    join public.profiles as profile on profile.id = therapist.user_id
    where therapist.id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'the verification detail includes the allowlisted professional email'
);

select is(
  public.admin_get_operation_detail_v1(
    'verifications',
    'fa100000-0000-4000-8000-000000000001'
  ) -> 'record' -> 'admin_verification_professional' ->> 'id',
  'c1000000-0000-4000-8000-000000000001',
  'the verification detail includes the therapist identifier'
);

select ok(
  nullif(
    public.admin_get_operation_detail_v1(
      'verifications',
      'fa100000-0000-4000-8000-000000000001'
    ) -> 'record' -> 'admin_verification_professional' ->> 'created_at',
    ''
  ) is not null,
  'the verification detail includes the therapist registration date'
);

select * from finish();

rollback;
