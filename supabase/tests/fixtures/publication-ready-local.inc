-- Test-only baseline, included AFTER BEGIN and restored by each test's ROLLBACK.
-- Satisfy current publication requirements; never relax the production predicate.
create or replace function pg_temp.prepare_public_profile(p_profile_id uuid)
returns void language plpgsql as $$
declare
  v_content_id uuid;
begin
  update public.therapist_profiles
  set public_status = 'published',
      photo_url = coalesce(photo_url, '/images/avatar-terapeuta.jpeg'),
      headline = coalesce(nullif(headline, ''), 'Atendimento online responsável'),
      bio = coalesce(nullif(bio, ''), 'Acolhimento e cuidado em sessões online.')
  where id = p_profile_id;

  select id into v_content_id
  from public.therapist_profile_content_versions
  where therapist_profile_id = p_profile_id and status = 'published'
  order by published_at desc nulls last, created_at desc limit 1;
  if v_content_id is null then
    insert into public.therapist_profile_content_versions
      (therapist_profile_id, status, short_intro, essence_body, published_at)
    values (p_profile_id, 'published', 'Atendimento online responsável',
            'Acolhimento e cuidado em sessões online.', now())
    returning id into v_content_id;
  end if;
  if not exists (select 1 from public.therapist_profile_guide_items
                 where content_version_id = v_content_id and is_active) then
    insert into public.therapist_profile_guide_items
      (content_version_id, icon, label, sort_order, is_active)
    values (v_content_id, 'heart', 'Cuidado e acolhimento', 1, true);
  end if;
end;
$$;

do $$
declare v_profile_id uuid;
begin
  foreach v_profile_id in array array[
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform pg_temp.prepare_public_profile(v_profile_id);
  end loop;
end;
$$;

update public.therapist_profiles
set status = 'approved', is_public = true, is_accepting_bookings = true,
    accepts_online_sessions = true
where id in ('c1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000002');

insert into public.therapist_connect_accounts (
  therapist_profile_id, stripe_account_id, onboarding_status, details_submitted,
  charges_enabled, payouts_enabled, stripe_transfers_status, operational_status,
  payout_status, payout_schedule_interval, pending_requirements, is_current
)
select id, 'acct_test_publication_' || replace(id::text, '-', ''),
       'ready', true, true, true, 'active', 'ready', 'enabled', 'daily', '[]'::jsonb, true
from public.therapist_profiles
where id in ('c1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000002')
on conflict (therapist_profile_id) where is_current do update
set onboarding_status = excluded.onboarding_status,
    details_submitted = true, charges_enabled = true, payouts_enabled = true,
    stripe_transfers_status = 'active', operational_status = 'ready',
    payout_status = 'enabled', payout_schedule_interval = 'daily',
    pending_requirements = '[]'::jsonb, closed_at = null;
