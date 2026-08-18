-- Public therapist identity: controlled themes, bio illustrations and plan-aware slugs.
-- The migration deliberately aborts if an existing current slug collides with
-- another therapist's history. That ambiguity must be resolved before rollout.

do $$
begin
  if exists (
    select 1
    from public.therapist_profiles p
    join public.therapist_profile_slug_history h on h.old_slug = p.slug
    where h.therapist_profile_id <> p.id
  ) then
    raise exception 'THERAPIST_SLUG_AUDIT_COLLISION' using errcode = 'P0001';
  end if;
end;
$$;

alter table public.therapist_profiles
  add column public_profile_theme text not null default 'serene',
  add column free_public_slug text;

alter table public.therapist_profiles
  add constraint therapist_profiles_public_profile_theme_check
    check (public_profile_theme in ('serene', 'natural', 'warm', 'essential')),
  add constraint therapist_profiles_free_public_slug_format_check
    check (free_public_slug is null or free_public_slug ~ '^[1-9][0-9]{6}$');

alter table public.therapist_profile_content_versions
  add column public_profile_theme text not null default 'serene',
  add column bio_illustration_id text;

alter table public.therapist_profile_content_versions
  add constraint therapist_profile_content_theme_check
    check (public_profile_theme in ('serene', 'natural', 'warm', 'essential')),
  add constraint therapist_profile_content_bio_illustration_check
    check (
      bio_illustration_id is null
      or bio_illustration_id in (
        'organic_flow',
        'gentle_horizon',
        'warm_layers',
        'essential_lines'
      )
    );

create or replace function public.normalize_therapist_public_slug_v1(p_slug text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      lower(public.unaccent(btrim(coalesce(p_slug, '')))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ))
$$;

create or replace function public.is_reserved_therapist_public_slug_v1(p_slug text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select public.normalize_therapist_public_slug_v1(p_slug) = any (array[
    'admin', 'admin-login', 'api', 'app', 'ajuda',
    'cancelamento-reagendamento-reembolso', 'cliente', 'confirmar-email',
    'para-terapeutas', 'privacidade', 'reserva', 'reset-senha', 'sobre-nos',
    'sua-jornada', 'terapeuta', 'terapeutas', 'terapias', 'termos',
    'login', 'cadastro', 'entrar', 'checkout', 'perfil', 'configuracoes',
    'agenda', 'sessoes', 'financeiro', 'suporte', 'dashboard', 'planos'
  ]::text[])
$$;

create or replace function public.therapist_public_slug_status_v1(
  p_therapist_profile_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text := public.normalize_therapist_public_slug_v1(p_slug);
  v_current_owner uuid;
  v_history_owner uuid;
begin
  if length(v_slug) < 3 or length(v_slug) > 40 then
    return jsonb_build_object('status', 'invalid', 'normalizedSlug', v_slug);
  end if;

  if public.is_reserved_therapist_public_slug_v1(v_slug) then
    return jsonb_build_object('status', 'reserved', 'normalizedSlug', v_slug);
  end if;

  select id into v_current_owner
  from public.therapist_profiles
  where slug = v_slug;

  if v_current_owner = p_therapist_profile_id then
    return jsonb_build_object('status', 'current', 'normalizedSlug', v_slug);
  elsif v_current_owner is not null then
    return jsonb_build_object('status', 'taken', 'normalizedSlug', v_slug);
  end if;

  select therapist_profile_id into v_history_owner
  from public.therapist_profile_slug_history
  where old_slug = v_slug;

  if v_history_owner is not null and v_history_owner <> p_therapist_profile_id then
    return jsonb_build_object('status', 'taken', 'normalizedSlug', v_slug);
  end if;

  return jsonb_build_object('status', 'available', 'normalizedSlug', v_slug);
end;
$$;

create or replace function public.generate_therapist_free_public_slug_v1()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_candidate text;
  v_attempt integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('therapist-free-public-slug', 0));

  while v_attempt < 100 loop
    v_attempt := v_attempt + 1;
    v_candidate := (1000000 + floor(random() * 9000000)::integer)::text;
    if not exists (select 1 from public.therapist_profiles where slug = v_candidate or free_public_slug = v_candidate)
      and not exists (select 1 from public.therapist_profile_slug_history where old_slug = v_candidate)
    then
      return v_candidate;
    end if;
  end loop;

  raise exception 'FREE_PUBLIC_SLUG_EXHAUSTED' using errcode = 'P0001';
end;
$$;

do $$
declare
  v_profile record;
  v_free_slug text;
begin
  for v_profile in
    select id, plan, slug
    from public.therapist_profiles
    order by id
    for update
  loop
    v_free_slug := public.generate_therapist_free_public_slug_v1();

    update public.therapist_profiles
    set free_public_slug = v_free_slug,
        public_profile_theme = 'serene'
    where id = v_profile.id;

    if v_profile.plan = 'free' and v_profile.slug <> v_free_slug then
      update public.therapist_profiles
      set slug = v_free_slug
      where id = v_profile.id;

      update public.therapist_profile_slug_history
      set current_slug = v_free_slug
      where therapist_profile_id = v_profile.id;

      insert into public.therapist_profile_slug_history (
        therapist_profile_id,
        old_slug,
        current_slug
      ) values (
        v_profile.id,
        v_profile.slug,
        v_free_slug
      )
      on conflict (old_slug) do update
      set current_slug = excluded.current_slug
      where public.therapist_profile_slug_history.therapist_profile_id = excluded.therapist_profile_id;
    end if;
  end loop;
end;
$$;

alter table public.therapist_profiles
  alter column free_public_slug set not null;

create unique index therapist_profiles_free_public_slug_key
  on public.therapist_profiles (free_public_slug);

create or replace function public.prepare_therapist_public_identity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.free_public_slug is null then
    new.free_public_slug := public.generate_therapist_free_public_slug_v1();
  end if;

  if new.plan = 'free' then
    new.slug := new.free_public_slug;
  end if;

  return new;
end;
$$;

create or replace function public.record_therapist_public_slug_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.slug is not distinct from new.slug then
    return new;
  end if;

  delete from public.therapist_profile_slug_history
  where old_slug = new.slug
    and therapist_profile_id = new.id;

  update public.therapist_profile_slug_history
  set current_slug = new.slug
  where therapist_profile_id = new.id;

  insert into public.therapist_profile_slug_history (
    therapist_profile_id,
    old_slug,
    current_slug
  ) values (
    new.id,
    old.slug,
    new.slug
  )
  on conflict (old_slug) do update
  set current_slug = excluded.current_slug
  where public.therapist_profile_slug_history.therapist_profile_id = excluded.therapist_profile_id;

  return new;
end;
$$;

create trigger prepare_therapist_public_identity
before insert or update of plan, free_public_slug on public.therapist_profiles
for each row execute function public.prepare_therapist_public_identity_v1();

create trigger record_therapist_public_slug_change
after update on public.therapist_profiles
for each row execute function public.record_therapist_public_slug_change_v1();

alter table public.therapist_profile_mutation_requests
  drop constraint therapist_profile_mutation_requests_action,
  add constraint therapist_profile_mutation_requests_action check (
    action in ('save_draft', 'discard_draft', 'publish', 'unpublish', 'update_slug')
  );

alter table public.therapist_profile_events
  drop constraint therapist_profile_events_type,
  add constraint therapist_profile_events_type check (
    event_type in (
      'profile_draft_saved',
      'profile_draft_discarded',
      'profile_published',
      'profile_unpublished',
      'profile_slug_updated'
    )
  );

create or replace function public.therapist_profile_capabilities_json_m1(
  p_plan public.therapist_plan
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'canPublishProfile', true,
    'canUploadVideo', p_plan in ('premium', 'premium_plus'),
    'canUseFeaturedMedia', p_plan in ('premium', 'premium_plus'),
    'canUseAdvancedSections', p_plan = 'premium_plus',
    'canPublishAdditionalServices', p_plan in ('premium', 'premium_plus'),
    'canCustomizePublicSlug', p_plan in ('premium', 'premium_plus')
  )
$$;

create or replace function public.therapist_profile_content_json_m1(
  p_content_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contentVersionId', content.id,
    'status', content.status,
    'baseProfileVersion', content.base_profile_version,
    'updatedAt', content.updated_at,
    'publishedAt', content.published_at,
    'fields', jsonb_strip_nulls(
      content.profile_payload ||
      jsonb_build_object(
        'shortIntro', content.short_intro,
        'essenceBody', content.essence_body,
        'invitationBody', content.invitation_body,
        'videoUrl', content.video_url,
        'videoProvider', content.video_provider,
        'videoThumbnailUrl', content.video_thumbnail_url,
        'videoTitle', content.video_title,
        'experienceYears', content.experience_years,
        'publicProfileTheme', content.public_profile_theme,
        'bioIllustrationId', content.bio_illustration_id,
        'guideItems', coalesce(guide_items.items, '[]'::jsonb),
        'reflections', coalesce(reflections.items, '[]'::jsonb)
      )
    )
  )
  from public.therapist_profile_content_versions as content
  left join lateral (
    select jsonb_agg(jsonb_build_object('icon', item.icon, 'label', item.label) order by item.sort_order) as items
    from public.therapist_profile_guide_items as item
    where item.content_version_id = content.id and item.is_active
  ) as guide_items on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'title', reflection.title,
        'excerpt', reflection.excerpt,
        'imageUrl', reflection.image_url,
        'href', reflection.href,
        'minutesToRead', reflection.minutes_to_read
      ) order by reflection.sort_order
    ) as items
    from public.therapist_profile_reflections as reflection
    where reflection.content_version_id = content.id and reflection.is_public
  ) as reflections on true
  where content.id = p_content_version_id
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
    'contractVersion', 2,
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
    'completeness', public.therapist_profile_completeness_json_m1(v_profile.id),
    'capabilities', public.therapist_profile_capabilities_json_m1(v_profile.plan)
  );
end;
$$;

alter function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb)
  rename to save_therapist_profile_draft_content_base_v1;

create function public.save_therapist_profile_draft_v1(
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
  v_theme text := coalesce(nullif(p_payload ->> 'publicProfileTheme', ''), 'serene');
  v_illustration text := nullif(p_payload ->> 'bioIllustrationId', '');
  v_response jsonb;
begin
  if v_theme not in ('serene', 'natural', 'warm', 'essential') then
    raise exception 'VALIDATION_ERROR: publicProfileTheme' using errcode = 'P0001';
  end if;
  if v_illustration is not null and v_illustration not in ('organic_flow', 'gentle_horizon', 'warm_layers', 'essential_lines') then
    raise exception 'VALIDATION_ERROR: bioIllustrationId' using errcode = 'P0001';
  end if;

  v_response := public.save_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version, p_payload
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

alter function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint)
  rename to publish_therapist_profile_draft_content_base_v1;

create function public.publish_therapist_profile_draft_v1(
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

  v_response := public.publish_therapist_profile_draft_content_base_v1(
    p_actor_user_id, p_request_id, p_expected_version
  );

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

create or replace function public.check_therapist_public_slug_availability_v1(
  p_actor_user_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  if v_profile.plan = 'free' then
    raise exception 'CAPABILITY_NOT_ALLOWED: custom_profile_slug' using errcode = 'P0001';
  end if;
  return public.therapist_public_slug_status_v1(v_profile.id, p_slug);
end;
$$;

create or replace function public.update_therapist_public_slug_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_slug text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_slug text := public.normalize_therapist_public_slug_v1(p_slug);
  v_status jsonb;
  v_payload_hash text := encode(extensions.digest(p_expected_version::text || ':' || v_slug, 'sha256'), 'hex');
  v_replay jsonb;
  v_response jsonb;
begin
  v_profile := public.get_therapist_profile_actor_m1(p_actor_user_id);
  v_replay := public.therapist_profile_request_replay_m1(v_profile.id, p_request_id, 'update_slug', v_payload_hash);
  if v_replay is not null then return v_replay; end if;

  if v_profile.plan = 'free' then
    raise exception 'CAPABILITY_NOT_ALLOWED: custom_profile_slug' using errcode = 'P0001';
  end if;
  if p_expected_version <> v_profile.profile_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('therapist-public-slug:' || v_slug, 0));
  select * into v_profile from public.therapist_profiles where id = v_profile.id for update;
  v_status := public.therapist_public_slug_status_v1(v_profile.id, v_slug);

  case v_status ->> 'status'
    when 'invalid' then raise exception 'SLUG_INVALID' using errcode = 'P0001';
    when 'reserved' then raise exception 'SLUG_RESERVED' using errcode = 'P0001';
    when 'taken' then raise exception 'SLUG_TAKEN' using errcode = 'P0001';
    when 'current' then null;
    else
      delete from public.therapist_profile_slug_history
      where therapist_profile_id = v_profile.id and old_slug = v_slug;
      update public.therapist_profiles
      set slug = v_slug,
          profile_version = profile_version + 1,
          updated_at = now()
      where id = v_profile.id
      returning * into v_profile;

      insert into public.therapist_profile_events (
        therapist_profile_id, actor_user_id, event_type, request_id,
        previous_public_status, next_public_status, previous_version, next_version,
        metadata
      ) values (
        v_profile.id, p_actor_user_id, 'profile_slug_updated', p_request_id,
        v_profile.public_status, v_profile.public_status, p_expected_version,
        v_profile.profile_version, jsonb_build_object('publicProfileSlug', v_profile.slug)
      );
  end case;

  v_response := jsonb_build_object(
    'contractVersion', 2,
    'idempotentReplay', false,
    'editor', public.get_private_therapist_profile_editor_v1(p_actor_user_id)
  );
  return public.therapist_profile_store_request_m1(
    v_profile.id, p_request_id, 'update_slug', v_payload_hash, v_response
  );
end;
$$;

-- PostgreSQL cannot remove a view column through CREATE OR REPLACE. Recreate
-- this public projection so the legacy internal identifier is removed.
drop view public.public_therapist_profile_content_v;

create view public.public_therapist_profile_content_v
with (security_invoker = true) as
select
  p.slug,
  v.short_intro,
  v.essence_body,
  v.invitation_body,
  v.experience_years,
  coalesce(guide_items.items, '[]'::jsonb) as guide_items,
  coalesce(reflections.items, '[]'::jsonb) as reflections,
  p.public_profile_theme,
  v.bio_illustration_id
from public.therapist_profiles p
join lateral (
  select
    content.id,
    content.therapist_profile_id,
    content.short_intro,
    content.essence_body,
    content.invitation_body,
    content.experience_years,
    content.public_profile_theme,
    content.bio_illustration_id
  from public.therapist_profile_content_versions content
  where content.therapist_profile_id = p.id
    and content.status = 'published'
  order by content.published_at desc nulls last, content.created_at desc
  limit 1
) v on true
left join lateral (
  select jsonb_agg(jsonb_build_object('icon', i.icon, 'label', i.label) order by i.sort_order) as items
  from public.therapist_profile_guide_items i
  where i.content_version_id = v.id and i.is_active
) guide_items on true
left join lateral (
  select jsonb_agg(jsonb_build_object('href', r.href, 'imageUrl', r.image_url, 'minutesToRead', r.minutes_to_read, 'title', r.title) order by r.sort_order) as items
  from public.therapist_profile_reflections r
  where r.content_version_id = v.id and r.is_public
) reflections on true
where public.is_therapist_publication_eligible_v1(p.id);

grant select (slug, public_profile_theme) on public.therapist_profiles to anon, authenticated, service_role;
grant select (public_profile_theme, bio_illustration_id) on public.therapist_profile_content_versions to anon, authenticated, service_role;
-- The security-invoker public view filters and orders published content by
-- these fields. They remain protected by the existing published-content RLS
-- policy and are not projected by the view.
grant select (status, published_at, created_at) on public.therapist_profile_content_versions to anon, authenticated, service_role;
-- The redirect view needs publication eligibility keyed by the private profile
-- FK. Keep that FK out of the public privilege surface and expose only a
-- tightly scoped, eligible pair of public slugs.
create or replace function public.public_therapist_slug_redirect_rows_v1()
returns table(old_slug text, current_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.old_slug, h.current_slug
  from public.therapist_profile_slug_history h
  where public.is_therapist_publication_eligible_v1(h.therapist_profile_id)
$$;

revoke all on function public.public_therapist_slug_redirect_rows_v1() from public, anon, authenticated;
grant execute on function public.public_therapist_slug_redirect_rows_v1() to anon, authenticated, service_role;
revoke all on public.therapist_profile_slug_history from anon, authenticated;

create or replace view public.public_therapist_slug_redirects_v
with (security_invoker = true) as
select old_slug, current_slug
from public.public_therapist_slug_redirect_rows_v1();

grant select on public.public_therapist_profile_content_v to anon, authenticated, service_role;
grant select on public.public_therapist_slug_redirects_v to anon, authenticated, service_role;

revoke all on function public.normalize_therapist_public_slug_v1(text) from public, anon, authenticated;
revoke all on function public.is_reserved_therapist_public_slug_v1(text) from public, anon, authenticated;
revoke all on function public.therapist_public_slug_status_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.generate_therapist_free_public_slug_v1() from public, anon, authenticated;
revoke all on function public.prepare_therapist_public_identity_v1() from public, anon, authenticated;
revoke all on function public.record_therapist_public_slug_change_v1() from public, anon, authenticated;
revoke all on function public.save_therapist_profile_draft_content_base_v1(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.publish_therapist_profile_draft_content_base_v1(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.check_therapist_public_slug_availability_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.update_therapist_public_slug_v1(uuid, uuid, bigint, text) from public, anon, authenticated;

grant execute on function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb) to service_role;
grant execute on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint) to service_role;
grant execute on function public.check_therapist_public_slug_availability_v1(uuid, text) to service_role;
grant execute on function public.update_therapist_public_slug_v1(uuid, uuid, bigint, text) to service_role;

comment on column public.therapist_profiles.public_profile_theme is
  'Published theme for the public profile hero. All plans may choose an official TES theme.';
comment on column public.therapist_profiles.free_public_slug is
  'Stable seven-digit public identifier restored whenever the effective plan becomes Free.';
comment on column public.therapist_profile_content_versions.bio_illustration_id is
  'Optional official TES bio illustration identifier; null means no illustration.';
comment on function public.update_therapist_public_slug_v1(uuid, uuid, bigint, text) is
  'Plan-aware, idempotent and concurrency-safe custom public slug command for authenticated Edge Functions.';
