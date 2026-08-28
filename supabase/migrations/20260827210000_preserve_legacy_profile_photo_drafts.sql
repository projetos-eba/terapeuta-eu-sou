-- Existing therapist drafts may reference a historic HTTP photo URL. Keep that
-- exact value editable while continuing to reject newly introduced HTTP media.

create or replace function public.therapist_profile_validate_payload_m1(
  p_payload jsonb,
  p_plan public.therapist_plan
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_public_name text := btrim(coalesce(p_payload ->> 'publicName', ''));
  v_headline text := nullif(btrim(coalesce(p_payload ->> 'headline', '')), '');
  v_bio text := nullif(btrim(coalesce(p_payload ->> 'bio', '')), '');
  v_photo_url text := nullif(btrim(coalesce(p_payload ->> 'photoUrl', '')), '');
  v_city text := nullif(btrim(coalesce(p_payload ->> 'city', '')), '');
  v_state text := nullif(btrim(coalesce(p_payload ->> 'state', '')), '');
  v_short_intro text := nullif(btrim(coalesce(p_payload ->> 'shortIntro', '')), '');
  v_essence_body text := nullif(btrim(coalesce(p_payload ->> 'essenceBody', '')), '');
  v_invitation_body text := nullif(btrim(coalesce(p_payload ->> 'invitationBody', '')), '');
  v_video_url text := nullif(btrim(coalesce(p_payload ->> 'videoUrl', '')), '');
  v_video_provider text := nullif(btrim(coalesce(p_payload ->> 'videoProvider', '')), '');
  v_video_thumbnail_url text := nullif(btrim(coalesce(p_payload ->> 'videoThumbnailUrl', '')), '');
  v_video_title text := nullif(btrim(coalesce(p_payload ->> 'videoTitle', '')), '');
  v_experience_years integer;
  v_guide_items jsonb := coalesce(p_payload -> 'guideItems', '[]'::jsonb);
  v_reflections jsonb := coalesce(p_payload -> 'reflections', '[]'::jsonb);
begin
  if v_public_name = '' or length(v_public_name) > 120 then
    raise exception 'VALIDATION_ERROR: publicName' using errcode = 'P0001';
  end if;
  if v_headline is not null and length(v_headline) > 180 then
    raise exception 'VALIDATION_ERROR: headline' using errcode = 'P0001';
  end if;
  if v_bio is not null and length(v_bio) > 1600 then
    raise exception 'VALIDATION_ERROR: bio' using errcode = 'P0001';
  end if;
  if v_short_intro is not null and length(v_short_intro) > 280 then
    raise exception 'VALIDATION_ERROR: shortIntro' using errcode = 'P0001';
  end if;
  if v_essence_body is not null and length(v_essence_body) > 1600 then
    raise exception 'VALIDATION_ERROR: essenceBody' using errcode = 'P0001';
  end if;
  if v_invitation_body is not null and length(v_invitation_body) > 600 then
    raise exception 'VALIDATION_ERROR: invitationBody' using errcode = 'P0001';
  end if;
  if v_video_url is not null then
    if p_plan = 'free' then
      raise exception 'CAPABILITY_NOT_ALLOWED: video' using errcode = 'P0001';
    end if;
    if v_video_url !~* '^https://[^[:space:]]+$' then
      raise exception 'VALIDATION_ERROR: videoUrl' using errcode = 'P0001';
    end if;
  end if;
  if v_photo_url is not null and v_photo_url !~* '^(https?://|/)[^[:space:]]+$' then
    raise exception 'VALIDATION_ERROR: photoUrl' using errcode = 'P0001';
  end if;
  if v_video_provider is not null and v_video_provider not in ('youtube', 'vimeo', 'upload', 'external') then
    raise exception 'VALIDATION_ERROR: videoProvider' using errcode = 'P0001';
  end if;
  if v_video_thumbnail_url is not null and v_video_thumbnail_url !~* '^(https://|/)[^[:space:]]+$' then
    raise exception 'VALIDATION_ERROR: videoThumbnailUrl' using errcode = 'P0001';
  end if;
  if p_payload ? 'experienceYears' and p_payload ->> 'experienceYears' <> '' then
    v_experience_years := (p_payload ->> 'experienceYears')::integer;
    if v_experience_years < 0 or v_experience_years > 80 then
      raise exception 'VALIDATION_ERROR: experienceYears' using errcode = 'P0001';
    end if;
  end if;
  if jsonb_typeof(v_guide_items) <> 'array' or jsonb_array_length(v_guide_items) > 6 then
    raise exception 'VALIDATION_ERROR: guideItems' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_reflections) <> 'array' or jsonb_array_length(v_reflections) > 6 then
    raise exception 'VALIDATION_ERROR: reflections' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'publicName', v_public_name, 'headline', v_headline, 'bio', v_bio,
    'photoUrl', v_photo_url, 'city', v_city, 'state', v_state,
    'shortIntro', v_short_intro, 'essenceBody', v_essence_body,
    'invitationBody', v_invitation_body, 'videoUrl', v_video_url,
    'videoProvider', coalesce(v_video_provider, 'external'),
    'videoThumbnailUrl', v_video_thumbnail_url, 'videoTitle', v_video_title,
    'experienceYears', v_experience_years, 'guideItems', v_guide_items,
    'reflections', v_reflections
  );
end;
$$;

create or replace function public.save_therapist_profile_draft_content_base_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_payload jsonb;
  v_requested_photo_url text := nullif(btrim(coalesce(p_payload ->> 'photoUrl', '')), '');
  v_payload_hash text := encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
  v_replay jsonb;
  v_content_id uuid;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'save_draft', v_payload_hash);
  if v_replay is not null then
    return v_replay;
  end if;
  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  if v_requested_photo_url ~* '^http://[^[:space:]]+$'
    and v_profile.photo_url is distinct from v_requested_photo_url
    and not exists (
      select 1
      from public.therapist_profile_content_versions as content
      where content.therapist_profile_id = v_profile.id
        and content.status in ('draft', 'published')
        and content.profile_payload ->> 'photoUrl' = v_requested_photo_url
    )
  then
    raise exception 'VALIDATION_ERROR: photoUrl' using errcode = 'P0001';
  end if;

  v_payload := public.therapist_profile_validate_payload_m1(p_payload, v_profile.plan);
  insert into public.therapist_profile_content_versions (
    therapist_profile_id, status, short_intro, essence_body, invitation_body,
    video_url, video_provider, video_thumbnail_url, video_title,
    experience_years, profile_payload, base_profile_version
  ) values (
    v_profile.id, 'draft', v_payload ->> 'shortIntro',
    v_payload ->> 'essenceBody', v_payload ->> 'invitationBody',
    v_payload ->> 'videoUrl', v_payload ->> 'videoProvider',
    v_payload ->> 'videoThumbnailUrl', v_payload ->> 'videoTitle',
    nullif(v_payload ->> 'experienceYears', '')::integer,
    jsonb_strip_nulls(jsonb_build_object(
      'publicName', v_payload ->> 'publicName', 'headline', v_payload ->> 'headline',
      'bio', v_payload ->> 'bio', 'photoUrl', v_payload ->> 'photoUrl',
      'city', v_payload ->> 'city', 'state', v_payload ->> 'state'
    )), v_profile.profile_version
  )
  on conflict (therapist_profile_id) where status = 'draft'
  do update set
    short_intro = excluded.short_intro, essence_body = excluded.essence_body,
    invitation_body = excluded.invitation_body, video_url = excluded.video_url,
    video_provider = excluded.video_provider,
    video_thumbnail_url = excluded.video_thumbnail_url,
    video_title = excluded.video_title, experience_years = excluded.experience_years,
    profile_payload = excluded.profile_payload,
    base_profile_version = excluded.base_profile_version, updated_at = now()
  returning id into v_content_id;

  perform public.therapist_profile_replace_children_m1(
    v_content_id, v_payload -> 'guideItems', v_payload -> 'reflections'
  );
  insert into public.therapist_profile_events (
    therapist_profile_id, actor_user_id, event_type, request_id,
    previous_public_status, next_public_status, previous_version, next_version
  ) values (
    v_profile.id, p_actor_user_id, 'profile_draft_saved', p_request_id,
    v_profile.public_status, v_profile.public_status,
    v_profile.profile_version, v_profile.profile_version
  );
  v_response := jsonb_build_object(
    'contractVersion', 1, 'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );
  return public.therapist_profile_store_request_m1(
    v_profile.id, p_request_id, 'save_draft', v_payload_hash, v_response
  );
end;
$$;

revoke all on function public.therapist_profile_validate_payload_m1(jsonb, public.therapist_plan) from public, anon, authenticated;
revoke all on function public.save_therapist_profile_draft_content_base_v1(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
