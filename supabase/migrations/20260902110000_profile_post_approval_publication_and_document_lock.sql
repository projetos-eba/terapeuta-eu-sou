-- The first eligible publication remains an administrative submission. Once a
-- therapist has been approved, later editorial publications keep the approved
-- lifecycle and public availability intact while preserving the existing
-- immutable profile_published audit event.

create or replace function public.publish_therapist_profile_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_theme text;
  v_response jsonb;
  v_requires_initial_review boolean;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  if v_profile.status = 'suspended'::public.therapist_status then
    raise exception 'PROFILE_SUSPENDED' using errcode = 'P0001';
  end if;

  select public_profile_theme into v_theme
  from public.therapist_profile_content_versions
  where therapist_profile_id = v_profile.id and status = 'draft'
  order by updated_at desc limit 1;

  if v_profile.plan = 'free' and v_theme in (
    'ancestral',
    'aurora',
    'botanico',
    'celestial',
    'cristalino',
    'energia',
    'essencial_editorial',
    'frequencia',
    'geometria',
    'lunar',
    'oraculo',
    'profundo',
    'sagrado',
    'sereno_horizonte',
    'vinculos'
  ) then
    v_theme := 'serene';
    update public.therapist_profile_content_versions
    set public_profile_theme = v_theme,
        updated_at = now()
    where therapist_profile_id = v_profile.id and status = 'draft';
  end if;

  -- The profile status is the authoritative administrative decision. A
  -- suspended profile never qualifies for this bypass because it is not
  -- approved. Approved professionals keep their public/bookable switches when
  -- publishing subsequent editorial versions.
  v_requires_initial_review := v_profile.status is distinct from 'approved'::public.therapist_status;

  v_response := public.publish_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version
  );

  if v_requires_initial_review
    and coalesce(v_response ->> 'idempotentReplay', 'false') <> 'true'
  then
    perform public.queue_therapist_profile_review_v1(v_profile.id);
  end if;

  if v_theme is null then
    select public_profile_theme into v_theme
    from public.therapist_profile_content_versions
    where therapist_profile_id = v_profile.id and status = 'published'
    order by published_at desc nulls last, created_at desc limit 1;
  end if;

  update public.therapist_profiles
  set public_profile_theme = coalesce(v_theme, 'serene')
  where id = v_profile.id;

  v_response := jsonb_set(
    v_response,
    '{editor}',
    public.get_private_therapist_profile_editor_v1(p_actor_user_id),
    true
  );
  update public.therapist_profile_mutation_requests
  set response = v_response
  where therapist_profile_id = v_profile.id and request_id = p_request_id and action = 'publish';
  return v_response;
end;
$$;

-- The Edge Function performs a friendly preflight before Storage upload. This
-- trigger is the authoritative guard for direct or concurrent server writes.
create or replace function public.prevent_accepted_therapist_private_document_replacement_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document_kind not in ('identity_document', 'address_proof') then
    return new;
  end if;

  if exists (
    select 1
    from public.therapist_private_documents existing_document
    where existing_document.therapist_profile_id = new.therapist_profile_id
      and existing_document.document_kind = new.document_kind
      and existing_document.status = 'accepted'
  ) then
    raise exception 'DOCUMENT_ALREADY_ACCEPTED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_accepted_therapist_private_document_replacement
  on public.therapist_private_documents;

create trigger prevent_accepted_therapist_private_document_replacement
before insert on public.therapist_private_documents
for each row execute function public.prevent_accepted_therapist_private_document_replacement_v1();

revoke all on function public.prevent_accepted_therapist_private_document_replacement_v1()
  from public, anon, authenticated;

comment on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint) is
  'Publishes an approved therapist editorial update directly while sending only first or non-approved profile publications to administrative review.';

comment on function public.prevent_accepted_therapist_private_document_replacement_v1() is
  'Blocks replacement of an accepted required private document until an authorized Admin requests a new submission.';
