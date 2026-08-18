-- Read-only preflight for the target environment. Run before applying
-- 20260818182608_therapist_public_profile_identity.sql.
with current_profiles as (
  select
    id,
    plan,
    slug,
    status,
    public_status,
    is_public,
    trim(both '-' from regexp_replace(
      regexp_replace(lower(public.unaccent(btrim(coalesce(slug, '')))), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )) as normalized_slug
  from public.therapist_profiles
), history as (
  select therapist_profile_id, old_slug, current_slug, created_at
  from public.therapist_profile_slug_history
)
select jsonb_build_object(
  'profiles', (select count(*) from current_profiles),
  'plans', coalesce((
    select jsonb_object_agg(plan, amount)
    from (select plan::text, count(*) as amount from current_profiles group by plan) grouped
  ), '{}'::jsonb),
  'nullSlugs', (select count(*) from current_profiles where slug is null),
  'duplicateCurrentSlugs', (
    select count(*) from (select slug from current_profiles group by slug having count(*) > 1) duplicated
  ),
  'duplicateNormalizedCurrentSlugs', (
    select count(*)
    from (
      select normalized_slug
      from current_profiles
      where normalized_slug <> ''
      group by normalized_slug
      having count(*) > 1
    ) duplicated
  ),
  'numericSevenDigitCurrentSlugs', (
    select count(*) from current_profiles where slug ~ '^[1-9][0-9]{6}$'
  ),
  'historyRows', (select count(*) from history),
  'historyPointingAwayFromCurrent', (
    select count(*)
    from history h
    join current_profiles p on p.id = h.therapist_profile_id
    where h.current_slug <> p.slug
  ),
  'crossProfessionalCurrentHistoryCollisions', (
    select count(*)
    from current_profiles p
    join history h on h.old_slug = p.slug
    where h.therapist_profile_id <> p.id
  ),
  'reservedCurrentSlugs', (
    select count(*)
    from current_profiles
    where normalized_slug = any (array[
      'admin', 'admin-login', 'api', 'app', 'ajuda',
      'cancelamento-reagendamento-reembolso', 'cliente', 'confirmar-email',
      'para-terapeutas', 'privacidade', 'reserva', 'reset-senha', 'sobre-nos',
      'sua-jornada', 'terapeuta', 'terapeutas', 'terapias', 'termos',
      'login', 'cadastro', 'entrar', 'checkout', 'perfil', 'configuracoes',
      'agenda', 'sessoes', 'financeiro', 'suporte', 'dashboard', 'planos'
    ]::text[])
  ),
  'incompatibleCurrentSlugs', (
    select count(*)
    from current_profiles
    where slug is null
      or slug <> normalized_slug
      or length(normalized_slug) < 3
      or length(normalized_slug) > 40
  ),
  'potentiallyBreakableUrls', (
    select count(*)
    from current_profiles
    where slug is null
      or normalized_slug = ''
      or normalized_slug = any (array[
        'admin', 'admin-login', 'api', 'app', 'ajuda',
        'cancelamento-reagendamento-reembolso', 'cliente', 'confirmar-email',
        'para-terapeutas', 'privacidade', 'reserva', 'reset-senha', 'sobre-nos',
        'sua-jornada', 'terapeuta', 'terapeutas', 'terapias', 'termos',
        'login', 'cadastro', 'entrar', 'checkout', 'perfil', 'configuracoes',
        'agenda', 'sessoes', 'financeiro', 'suporte', 'dashboard', 'planos'
      ]::text[])
  ),
  'profilesWithoutPublishedPublicSurface', (
    select count(*)
    from current_profiles
    where not is_public or public_status <> 'published'
  ),
  'freeProfilesWithNonNumericCurrentSlug', (
    select count(*)
    from current_profiles
    where plan = 'free' and slug !~ '^[1-9][0-9]{6}$'
  ),
  'paidProfilesWithNumericCurrentSlug', (
    select count(*)
    from current_profiles
    where plan in ('premium', 'premium_plus') and slug ~ '^[1-9][0-9]{6}$'
  )
) as audit_summary;

select
  p.id as current_profile_id,
  p.slug as conflicting_slug,
  h.therapist_profile_id as historical_owner_profile_id,
  h.current_slug as historical_redirect_target
from public.therapist_profiles p
join public.therapist_profile_slug_history h on h.old_slug = p.slug
where h.therapist_profile_id <> p.id
order by p.slug;

with current_profiles as (
  select
    id,
    trim(both '-' from regexp_replace(
      regexp_replace(lower(public.unaccent(btrim(coalesce(slug, '')))), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )) as normalized_slug
  from public.therapist_profiles
)
select
  normalized_slug,
  array_agg(id order by id) as therapist_profile_ids,
  count(*) as profile_count
from (
  select id, normalized_slug
  from current_profiles
  where normalized_slug <> ''
) normalized
group by normalized_slug
having count(*) > 1
order by normalized_slug;
