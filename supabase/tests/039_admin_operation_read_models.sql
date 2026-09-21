begin;

select plan(39);

select ok(
  to_regprocedure(
    'public.admin_get_operation_module_v1(text,integer,integer)'
  ) is not null,
  'admin operation read model RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_operation_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin operation read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_operation_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated role can invoke RPC after in-function admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_operation_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'service_role can invoke RPC for server-side administrative adapters'
);

select ok(
  to_regprocedure(
    'public.admin_get_operation_detail_v1(text,uuid)'
  ) is not null,
  'admin operation detail read model RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_operation_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin operation detail read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_operation_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  'authenticated role can invoke detail RPC after in-function admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_operation_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  'service_role can invoke detail RPC for server-side administrative adapters'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_operation_module_v1(''professionals'')',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read horizontal admin operation data'
);

select throws_ok(
  format(
    'select public.admin_get_operation_detail_v1(''professionals'', %L::uuid)',
    (select id from public.therapist_profiles limit 1)
  ),
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read admin operation details'
);

reset role;

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
    public.admin_get_operation_module_v1('professionals')
      -> 'metrics'
      ->> 'total-professionals'
  )::integer,
  (select count(*)::integer from public.therapist_profiles),
  'professionals metric uses canonical therapist_profiles count'
);

select ok(
  jsonb_array_length(
    public.admin_get_operation_module_v1('professionals') -> 'rows'
  ) > 0,
  'professionals list returns real rows for admin'
);

create temporary table admin_professional_projection_target (
  therapist_profile_id uuid primary key
) on commit drop;

insert into admin_professional_projection_target (therapist_profile_id)
select id
from public.therapist_profiles
order by updated_at desc, id desc
limit 1;

update public.profiles
set email = 'admin-professional-list@example.test'
where id = (
  select therapist.user_id
  from public.therapist_profiles as therapist
  join admin_professional_projection_target as target
    on target.therapist_profile_id = therapist.id
);

update public.therapist_profiles
set photo_url = '/images/avatar-terapeuta.jpeg'
where id = (select therapist_profile_id from admin_professional_projection_target);

update public.therapist_connect_accounts
set is_current = false,
    updated_at = now()
where therapist_profile_id = (
  select therapist_profile_id from admin_professional_projection_target
)
  and is_current;

insert into public.therapist_connect_accounts (
  therapist_profile_id,
  stripe_account_id,
  account_generation,
  is_current,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status,
  payout_status,
  payout_schedule_interval,
  pending_requirements
)
select
  therapist_profile_id,
  'acct_test_admin_projection_current_' || replace(therapist_profile_id::text, '-', ''),
  (
    select coalesce(max(account_generation), 0) + 1
    from public.therapist_connect_accounts
    where therapist_profile_id = admin_professional_projection_target.therapist_profile_id
  ),
  true,
  'ready',
  true,
  true,
  true,
  'active',
  'ready',
  'enabled',
  'daily',
  '[]'::jsonb
from admin_professional_projection_target;

insert into public.therapist_connect_accounts (
  therapist_profile_id,
  stripe_account_id,
  account_generation,
  is_current,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status,
  payout_status,
  payout_schedule_interval,
  pending_requirements
)
select
  therapist_profile_id,
  'acct_test_admin_projection_historical_' || replace(therapist_profile_id::text, '-', ''),
  (
    select coalesce(max(account_generation), 0) + 1
    from public.therapist_connect_accounts
    where therapist_profile_id = admin_professional_projection_target.therapist_profile_id
  ),
  false,
  'disabled',
  false,
  false,
  false,
  'inactive',
  'disabled',
  'disabled',
  null,
  '[]'::jsonb
from admin_professional_projection_target;

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('professionals', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = (
      select therapist_profile_id::text from admin_professional_projection_target
    )
  ),
  1,
  'professional list keeps one row when Connect history has retired accounts'
);

select is(
  (
    select row_payload ->> 'connect_status'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('professionals', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = (
      select therapist_profile_id::text from admin_professional_projection_target
    )
  ),
  'ready',
  'professional list reads only the current Connect account status'
);

select is(
  (
    select row_payload ->> 'email'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('professionals', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = (
      select therapist_profile_id::text from admin_professional_projection_target
    )
  ),
  'admin-professional-list@example.test',
  'professional list includes the allowlisted email for Admin'
);

select is(
  (
    select row_payload ->> 'photo_url'
    from jsonb_array_elements(
      public.admin_get_operation_module_v1('professionals', 50, 0) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = (
      select therapist_profile_id::text from admin_professional_projection_target
    )
  ),
  '/images/avatar-terapeuta.jpeg',
  'professional list includes the canonical therapist profile photo'
);

select is(
  (
    public.admin_get_operation_module_v2('professionals', '{}'::jsonb)
      -> 'page'
      ->> 'total'
  )::integer,
  (select count(*)::integer from public.therapist_profiles),
  'paginated professionals total remains one row per canonical therapist profile'
);

select ok(
  (
    public.admin_get_operation_module_v1('professionals')
      -> 'rows'
      -> 0
  ) ? 'service_count',
  'professionals DTO includes operational service count'
);

select is(
  (
    public.admin_get_operation_module_v1('professionals')
      -> 'rows'
      -> 0
  ) ? 'legal_name',
  false,
  'professionals DTO does not expose private legal name in list'
);

select is(
  (
    public.admin_get_operation_module_v1('patients')
      -> 'metrics'
      ->> 'total-patients'
  )::integer,
  (select count(*)::integer from public.patient_profiles),
  'patients metric uses canonical patient_profiles count'
);

select ok(
  jsonb_array_length(
    public.admin_get_operation_module_v1('patients') -> 'rows'
  ) > 0,
  'patients list returns real rows for admin'
);

select ok(
  (
    public.admin_get_operation_module_v1('patients')
      -> 'rows'
      -> 0
  ) ? 'booking_count',
  'patients DTO includes aggregate booking count'
);

select is(
  (
    public.admin_get_operation_module_v1('patients')
      -> 'rows'
      -> 0
  ) ? 'phone',
  false,
  'patients DTO does not expose phone in operational list'
);

select is(
  (
    public.admin_get_operation_module_v1('sessions')
      -> 'metrics'
      ->> 'total-sessions'
  )::integer,
  (select count(*)::integer from public.bookings),
  'sessions metric uses canonical bookings count'
);

select is(
  coalesce(
    (
      public.admin_get_operation_module_v1('sessions')
        -> 'rows'
        -> 0
    ) ? 'meeting_url',
    false
  ),
  false,
  'sessions DTO does not expose meeting URL'
);

select is(
  (
    public.admin_get_operation_module_v1('support')
      -> 'metrics'
      ->> 'total-support'
  )::integer,
  (select count(*)::integer from public.support_tickets),
  'support metric uses canonical support_tickets count'
);

select is(
  coalesce(
    (
      public.admin_get_operation_module_v1('support')
        -> 'rows'
        -> 0
    ) ? 'description',
    false
  ),
  false,
  'support DTO does not expose full ticket description'
);

select is(
  (
    public.admin_get_operation_module_v1('reviews')
      -> 'metrics'
      ->> 'total-reviews'
  )::integer,
  (select count(*)::integer from public.reviews),
  'reviews metric uses canonical reviews count'
);

select is(
  coalesce(
    (
      public.admin_get_operation_module_v1('reviews')
        -> 'rows'
        -> 0
    ) ? 'comment',
    false
  ),
  false,
  'reviews DTO does not expose comment body in operational list'
);

select is(
  (
    public.admin_get_operation_module_v1('verifications')
      -> 'metrics'
      ->> 'total-verifications'
  )::integer,
  (
    select count(distinct therapist_profile_id)::integer
    from public.therapist_verifications
  ),
  'verifications metric counts the current queue identity per therapist'
);

select ok(
  (
    public.admin_get_operation_detail_v1(
      'professionals',
      (select id from public.therapist_profiles limit 1)
    ) -> 'record'
  ) ? 'service_count',
  'professional detail returns operational aggregates'
);

select is(
  (
    public.admin_get_operation_detail_v1(
      'professionals',
      (select id from public.therapist_profiles limit 1)
    ) -> 'record'
  ) ? 'legal_name',
  false,
  'professional detail does not expose legal name'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        (select id from public.bookings limit 1)
      ) -> 'record'
    ) ? 'meeting_url',
    false
  ),
  false,
  'session detail does not expose meeting URL'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'support',
        (select id from public.support_tickets limit 1)
      ) -> 'record'
    ) ? 'description',
    false
  ),
  false,
  'support detail does not expose full ticket description'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'reviews',
        (select id from public.reviews limit 1)
      ) -> 'record'
    ) ? 'comment',
    false
  ),
  false,
  'review detail does not expose comment body'
);

insert into public.therapist_verifications (
  therapist_profile_id,
  documents_metadata,
  status
)
select
  therapist_profiles.id,
  '{"privatePath":"therapist-private-documents/test.pdf"}'::jsonb,
  'submitted'::public.therapist_status
from public.therapist_profiles
limit 1;

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'verifications',
        (select id from public.therapist_verifications limit 1)
      ) -> 'record'
    ) ? 'documents_metadata',
    false
  ),
  false,
  'verification detail does not expose document metadata'
);

select is(
  public.admin_get_operation_detail_v1(
    'professionals',
    '00000000-0000-4000-8000-000000000000'::uuid
  ) -> 'record',
  'null'::jsonb,
  'missing operation detail returns null record'
);

select throws_ok(
  'select public.admin_get_operation_module_v1(''unknown'')',
  '22023',
  'unsupported admin operation module: unknown',
  'unknown admin operation module fails closed'
);

select throws_ok(
  format(
    'select public.admin_get_operation_detail_v1(''unknown'', %L::uuid)',
    (select id from public.therapist_profiles limit 1)
  ),
  '22023',
  'unsupported admin operation module: unknown',
  'unknown admin operation detail module fails closed'
);

select * from finish();

rollback;
