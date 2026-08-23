-- Local-only renewable browser fixtures. These bookings exercise real
-- cancellation, rescheduling and the mocked Zoom entry controls, so their time
-- windows must stay valid after a developer reapplies local seeds. This file
-- is referenced exclusively by supabase/config.toml and is never a production
-- migration.
update public.bookings
set
  starts_at = case id
    when 'f2000000-0000-4000-8000-000000000001'::uuid then now() + interval '10 minutes'
    when 'f2000000-0000-4000-8000-000000000002'::uuid then now() + interval '3 days'
    when 'f2000000-0000-4000-8000-000000000004'::uuid then now() + interval '4 days'
  end,
  ends_at = case id
    when 'f2000000-0000-4000-8000-000000000001'::uuid then now() + interval '1 hour 10 minutes'
    when 'f2000000-0000-4000-8000-000000000002'::uuid then now() + interval '3 days 1 hour'
    when 'f2000000-0000-4000-8000-000000000004'::uuid then now() + interval '4 days 1 hour'
  end,
  updated_at = now()
where id in (
  'f2000000-0000-4000-8000-000000000001'::uuid,
  'f2000000-0000-4000-8000-000000000002'::uuid,
  'f2000000-0000-4000-8000-000000000004'::uuid
)
  and status = 'confirmed';
