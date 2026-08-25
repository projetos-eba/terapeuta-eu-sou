alter table public.therapist_profile_mutation_requests
  drop constraint therapist_profile_mutation_requests_action,
  add constraint therapist_profile_mutation_requests_action check (
    action in (
      'save_draft',
      'save_media_draft',
      'discard_draft',
      'publish',
      'unpublish',
      'update_slug'
    )
  );

alter table public.therapist_profile_events
  drop constraint therapist_profile_events_type,
  add constraint therapist_profile_events_type check (
    event_type in (
      'profile_draft_saved',
      'profile_media_draft_saved',
      'profile_draft_discarded',
      'profile_published',
      'profile_unpublished',
      'profile_slug_updated'
    )
  );

create or replace function public.save_therapist_profile_media_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_kind text,
  p_media_url text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_draft public.therapist_profile_content_versions%rowtype;
  v_published public.therapist_profile_content_versions%rowtype;
  v_payload_hash text := encode(
    extensions.digest(
      p_expected_version::text || ':' || coalesce(p_kind, '') || ':' || coalesce(p_media_url, ''),
      'sha256'
    ),
    'hex'
  );
  v_replay jsonb;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(
    v_profile.id,
    p_request_id,
    'save_media_draft',
    v_payload_hash
  );
  if v_replay is not null then
    return v_replay;
  end if;

  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  if p_kind <> 'photo'
    or p_media_url is null
    or position(
      '/storage/v1/object/public/therapist-public-media/' ||
      p_actor_user_id::text || '/profile/photo-'
      in p_media_url
    ) = 0
  then
    raise exception 'VALIDATION_ERROR: photo_url' using errcode = 'P0001';
  end if;

  select *
    into v_draft
  from public.therapist_profile_content_versions
  where therapist_profile_id = v_profile.id
    and status = 'draft'
  order by updated_at desc
  limit 1
  for update;

  if v_draft.id is not null then
    update public.therapist_profile_content_versions
    set profile_payload = jsonb_set(
          coalesce(profile_payload, '{}'::jsonb),
          '{photoUrl}',
          to_jsonb(p_media_url),
          true
        ),
        updated_at = now()
    where id = v_draft.id;
  else
    select *
      into v_published
    from public.therapist_profile_content_versions
    where therapist_profile_id = v_profile.id
      and status = 'published'
    order by published_at desc nulls last, created_at desc
    limit 1;

    insert into public.therapist_profile_content_versions (
      therapist_profile_id,
      status,
      short_intro,
      essence_body,
      invitation_body,
      video_url,
      video_provider,
      video_thumbnail_url,
      video_title,
      experience_years,
      profile_payload,
      base_profile_version,
      public_profile_theme,
      bio_illustration_id
    )
    values (
      v_profile.id,
      'draft',
      v_published.short_intro,
      v_published.essence_body,
      v_published.invitation_body,
      v_published.video_url,
      v_published.video_provider,
      v_published.video_thumbnail_url,
      v_published.video_title,
      v_published.experience_years,
      jsonb_strip_nulls(
        coalesce(v_published.profile_payload, '{}'::jsonb) ||
        jsonb_build_object(
          'publicName', coalesce(v_profile.public_name, v_published.profile_payload ->> 'publicName'),
          'headline', coalesce(v_profile.headline, v_published.profile_payload ->> 'headline'),
          'bio', coalesce(v_profile.bio, v_published.profile_payload ->> 'bio'),
          'photoUrl', p_media_url,
          'city', coalesce(v_profile.city, v_published.profile_payload ->> 'city'),
          'state', coalesce(v_profile.state, v_published.profile_payload ->> 'state')
        )
      ),
      v_profile.profile_version,
      coalesce(v_published.public_profile_theme, v_profile.public_profile_theme, 'serene'),
      v_published.bio_illustration_id
    );
  end if;

  insert into public.therapist_profile_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_public_status,
    next_public_status,
    previous_version,
    next_version,
    metadata
  )
  values (
    v_profile.id,
    p_actor_user_id,
    'profile_media_draft_saved',
    p_request_id,
    v_profile.public_status,
    v_profile.public_status,
    v_profile.profile_version,
    v_profile.profile_version,
    jsonb_build_object('kind', p_kind)
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );

  return public.therapist_profile_store_request_m1(
    v_profile.id,
    p_request_id,
    'save_media_draft',
    v_payload_hash,
    v_response
  );
end;
$$;

revoke all on function public.save_therapist_profile_media_draft_v1(uuid, uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.save_therapist_profile_media_draft_v1(uuid, uuid, bigint, text, text)
  to service_role;
