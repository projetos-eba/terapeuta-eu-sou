begin;

select plan(34);

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

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
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
  (select count(*)::integer from public.therapist_verifications),
  'verifications metric uses canonical therapist_verifications count'
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
