-- Profile theme library: four Free themes plus fifteen Premium themes.
-- No columns or tables are added. Existing theme values remain valid.

alter table public.therapist_profiles
  drop constraint therapist_profiles_public_profile_theme_check,
  add constraint therapist_profiles_public_profile_theme_check
    check (public_profile_theme in (
      'ancestral',
      'aurora',
      'botanico',
      'celestial',
      'cristalino',
      'energia',
      'essencial_editorial',
      'essential',
      'frequencia',
      'geometria',
      'lunar',
      'natural',
      'oraculo',
      'profundo',
      'sagrado',
      'sereno_horizonte',
      'serene',
      'vinculos',
      'warm'
    ));

alter table public.therapist_profile_content_versions
  drop constraint therapist_profile_content_theme_check,
  add constraint therapist_profile_content_theme_check
    check (public_profile_theme in (
      'ancestral',
      'aurora',
      'botanico',
      'celestial',
      'cristalino',
      'energia',
      'essencial_editorial',
      'essential',
      'frequencia',
      'geometria',
      'lunar',
      'natural',
      'oraculo',
      'profundo',
      'sagrado',
      'sereno_horizonte',
      'serene',
      'vinculos',
      'warm'
    ));

create or replace function public.save_therapist_profile_draft_v1(
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
  v_current_draft_theme text;
  v_theme text := coalesce(nullif(p_payload ->> 'publicProfileTheme', ''), 'serene');
  v_illustration text := nullif(p_payload ->> 'bioIllustrationId', '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);

  if v_theme not in (
    'ancestral',
    'aurora',
    'botanico',
    'celestial',
    'cristalino',
    'energia',
    'essencial_editorial',
    'essential',
    'frequencia',
    'geometria',
    'lunar',
    'natural',
    'oraculo',
    'profundo',
    'sagrado',
    'sereno_horizonte',
    'serene',
    'vinculos',
    'warm'
  ) then
    raise exception 'VALIDATION_ERROR: publicProfileTheme' using errcode = 'P0001';
  end if;

  if v_illustration is not null and v_illustration not in (
    'organic_flow',
    'gentle_horizon',
    'warm_layers',
    'essential_lines'
  ) then
    raise exception 'VALIDATION_ERROR: bioIllustrationId' using errcode = 'P0001';
  end if;

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
    select public_profile_theme
      into v_current_draft_theme
    from public.therapist_profile_content_versions
    where therapist_profile_id = v_profile.id
      and status = 'draft'
    order by updated_at desc
    limit 1;

    if v_profile.public_profile_theme in (
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
    ) or v_current_draft_theme in (
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
    else
      raise exception 'CAPABILITY_NOT_ALLOWED: premium_profile_themes' using errcode = 'P0001';
    end if;
  end if;

  v_payload := jsonb_set(v_payload, '{publicProfileTheme}', to_jsonb(v_theme), true);

  v_response := public.save_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version, v_payload
  );
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);

  update public.therapist_profile_content_versions
  set public_profile_theme = v_theme,
      bio_illustration_id = v_illustration,
      updated_at = now()
  where therapist_profile_id = v_profile.id and status = 'draft';

  v_response := jsonb_set(v_response, '{editor}', public.get_private_therapist_profile_editor_v1(p_actor_user_id), true);
  update public.therapist_profile_mutation_requests
  set response = v_response
  where therapist_profile_id = v_profile.id and request_id = p_request_id and action = 'save_draft';
  return v_response;
end;
$$;

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
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
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

  v_response := public.publish_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version
  );

  if coalesce(v_response ->> 'idempotentReplay', 'false') <> 'true' then
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

  v_response := jsonb_set(v_response, '{editor}', public.get_private_therapist_profile_editor_v1(p_actor_user_id), true);
  update public.therapist_profile_mutation_requests
  set response = v_response
  where therapist_profile_id = v_profile.id and request_id = p_request_id and action = 'publish';
  return v_response;
end;
$$;
