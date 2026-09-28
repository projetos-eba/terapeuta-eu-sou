begin;

-- Receipts V6 preserves the historical V5 list and summary. It adds a
-- separate, forward-looking view of sessions that already have an active
-- charge schedule, always scoped to the therapist's current local date plus
-- the following 29 calendar days.
create or replace function public.get_private_therapist_receipts_v6(
  p_period_start date default null,
  p_period_end date default null,
  p_status text default null,
  p_therapy_id uuid default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_upcoming_period_start date;
  v_upcoming_period_end date;
  v_upcoming_starts_at timestamptz;
  v_upcoming_ends_at timestamptz;
  v_upcoming_scheduled jsonb;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  v_upcoming_period_start := (now() at time zone v_period.timezone)::date;
  v_upcoming_period_end := v_upcoming_period_start + 29;
  v_upcoming_starts_at :=
    v_upcoming_period_start::timestamp at time zone v_period.timezone;
  v_upcoming_ends_at :=
    (v_upcoming_period_end + 1)::timestamp at time zone v_period.timezone;

  v_payload := public.get_private_therapist_receipts_v5(
    p_period_start,
    p_period_end,
    p_status,
    p_therapy_id,
    p_search,
    p_page,
    p_page_size,
    p_timezone
  );

  select jsonb_build_object(
    'amountCents', coalesce(sum(greatest(0, payment.therapist_amount_cents)), 0)::integer,
    'sessionCount', count(*)::integer,
    'periodStart', v_upcoming_period_start,
    'periodEnd', v_upcoming_period_end
  )
  into v_upcoming_scheduled
  from public.session_payments as payment
  join public.bookings as booking
    on booking.id = payment.booking_id
  where payment.therapist_profile_id = v_therapist.id
    and booking.starts_at >= v_upcoming_starts_at
    and booking.starts_at < v_upcoming_ends_at
    and public.private_therapist_charge_status_v3(payment.id) = 'scheduled';

  v_payload := jsonb_set(
    v_payload,
    '{summary,upcomingScheduled}',
    v_upcoming_scheduled,
    true
  );

  return jsonb_set(v_payload, '{contractVersion}', '6'::jsonb, true);
end;
$$;

revoke all on function public.get_private_therapist_receipts_v6(
  date, date, text, uuid, text, integer, integer, text
) from public, anon;

grant execute on function public.get_private_therapist_receipts_v6(
  date, date, text, uuid, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_receipts_v6(
  date, date, text, uuid, text, integer, integer, text
) is
  'Private therapist receipts V6: V5 historical receipts plus active scheduled charges in the next 30 local calendar days.';

commit;
