-- Editorial publication state is not, by itself, public availability.
-- Keep it intact for review/history, while exposing the effective public gate
-- consistently to the therapist's private surfaces.

begin;

create or replace function public.therapist_publication_state_json_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_eligibility jsonb;
begin
  select *
    into v_profile
  from public.therapist_profiles
  where id = p_therapist_profile_id;

  if v_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_eligibility := public.get_therapist_publication_eligibility_v1(
    v_profile.id
  );

  return jsonb_build_object(
    'isPubliclyVisible', coalesce(
      (v_eligibility ->> 'eligible')::boolean,
      false
    ),
    'needsReceivingAccount', coalesce(
      v_eligibility -> 'blockers' ? 'receiving_account_not_ready',
      false
    )
  );
end;
$$;

create or replace function public.get_private_therapist_publication_state_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
begin
  v_profile := public.get_therapist_profile_actor_m1(auth.uid());

  return public.therapist_publication_state_json_v1(v_profile.id);
end;
$$;

create or replace function public.get_private_therapist_profile_editor_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_draft jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);

  select public.therapist_profile_content_json_m1(content.id)
    into v_draft
  from public.therapist_profile_content_versions as content
  where content.therapist_profile_id = v_profile.id
    and content.status = 'draft'
  order by content.updated_at desc
  limit 1;

  return jsonb_build_object(
    'contractVersion', 3,
    'therapistProfileId', v_profile.id,
    'version', v_profile.profile_version,
    'updatedAt', v_profile.updated_at,
    'publicProfileHref', '/terapeutas/' || v_profile.slug,
    'publicProfileSlug', v_profile.slug,
    'publicProfileTheme', v_profile.public_profile_theme,
    'propagationNotice', 'As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.',
    'published', public.therapist_profile_published_fields_m1(v_profile),
    'draft', v_draft,
    'derived', public.therapist_profile_derived_json_m1(v_profile.id),
    'publication', public.therapist_publication_state_json_v1(v_profile.id),
    'completeness', public.therapist_profile_completeness_json_m1(v_profile.id),
    'capabilities', public.therapist_profile_capabilities_json_m1(v_profile.plan)
  );
end;
$$;

revoke all on function public.therapist_publication_state_json_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.get_private_therapist_publication_state_v1()
  from public, anon;
grant execute on function public.get_private_therapist_publication_state_v1()
  to authenticated, service_role;

comment on function public.therapist_publication_state_json_v1(uuid) is
  'Internal effective-publication projection. It keeps editorial state separate from public visibility and the receiving-account gate.';
comment on function public.get_private_therapist_publication_state_v1() is
  'Authenticated therapist-only publication state for private TES surfaces.';

commit;
