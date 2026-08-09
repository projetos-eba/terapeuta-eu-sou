begin;

select plan(25);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_profile_editor_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute therapist profile editor read model'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_profile_editor_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile editor read model directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.get_private_therapist_profile_editor_v1(uuid)',
    'EXECUTE'
  ),
  true,
  'service_role can execute therapist profile editor read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.save_therapist_profile_draft_v1(uuid,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute therapist profile save draft command'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.save_therapist_profile_draft_v1(uuid,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile save draft command directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.save_therapist_profile_draft_v1(uuid,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  true,
  'service_role can execute therapist profile save draft command'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.discard_therapist_profile_draft_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile discard draft command directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.discard_therapist_profile_draft_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'service_role can execute therapist profile discard draft command'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.publish_therapist_profile_draft_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile publish command directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.publish_therapist_profile_draft_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'service_role can execute therapist profile publish command'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.unpublish_therapist_profile_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile unpublish command directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.unpublish_therapist_profile_v1(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'service_role can execute therapist profile unpublish command'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_validate_payload_m1(jsonb,public.therapist_plan)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile payload validator directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.therapist_profile_validate_payload_m1(jsonb,public.therapist_plan)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapist profile payload validator directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_content_json_m1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile content helper directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.therapist_profile_content_json_m1(uuid)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapist profile content helper directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_derived_json_m1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile derived helper directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.therapist_profile_derived_json_m1(uuid)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapist profile derived helper directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_published_fields_m1(public.therapist_profiles)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile published fields helper directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.therapist_profile_published_fields_m1(public.therapist_profiles)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapist profile published fields helper directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_request_replay_m1(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile request replay helper directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_store_request_m1(uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile request store helper directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.therapist_profile_replace_children_m1(uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist profile child replacement helper directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.therapist_profile_replace_children_m1(uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapist profile child replacement helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.therapist_profile_content_json_m1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute therapist profile content helper directly'
);

select * from finish();

rollback;
