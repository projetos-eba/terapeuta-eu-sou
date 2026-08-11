create or replace function public.ensure_video_session_for_paid_booking_v1(
  p_booking_id uuid,
  p_environment text,
  p_source text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_session_id uuid;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.session_payments sp
    where sp.booking_id = p_booking_id
      and sp.financial_status = 'paid'
  ) then
    raise exception 'booking_payment_not_confirmed' using errcode = 'P0001';
  end if;

  if v_booking.status in (
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'refunded'
  ) then
    raise exception 'booking_closed' using errcode = 'P0001';
  end if;

  with upserted as (
    insert into public.video_sessions (
      booking_id,
      environment,
      session_name,
      session_key,
      scheduled_starts_at,
      scheduled_ends_at,
      status,
      metadata
    )
    values (
      v_booking.id,
      p_environment,
      public.create_zoom_video_session_name_v1(v_booking.id, p_environment),
      public.create_zoom_video_session_key_v1(v_booking.id, p_environment),
      v_booking.starts_at,
      v_booking.ends_at,
      'ready',
      jsonb_build_object('source', left(coalesce(p_source, 'system'), 80))
    )
    on conflict (booking_id) do update
    set scheduled_starts_at = excluded.scheduled_starts_at,
        scheduled_ends_at = excluded.scheduled_ends_at,
        status = case
          when public.video_sessions.status in ('canceled', 'failed')
            then public.video_sessions.status
          when public.video_sessions.status = 'ended'
            then 'ended'::public.video_session_status
          else 'ready'::public.video_session_status
        end,
        metadata = public.video_sessions.metadata || excluded.metadata,
        version = public.video_sessions.version + 1,
        updated_at = now()
    where (
      public.video_sessions.scheduled_starts_at,
      public.video_sessions.scheduled_ends_at,
      public.video_sessions.status,
      public.video_sessions.metadata
    ) is distinct from (
      excluded.scheduled_starts_at,
      excluded.scheduled_ends_at,
      case
        when public.video_sessions.status in ('canceled', 'failed')
          then public.video_sessions.status
        when public.video_sessions.status = 'ended'
          then 'ended'::public.video_session_status
        else 'ready'::public.video_session_status
      end,
      public.video_sessions.metadata || excluded.metadata
    )
    returning id
  )
  select candidate.id
    into v_session_id
  from (
    select id
    from upserted

    union all

    select existing.id
    from public.video_sessions as existing
    where existing.booking_id = v_booking.id
      and not exists (select 1 from upserted)
  ) as candidate
  limit 1;

  update public.bookings
  set meeting_provider = 'zoom_video_sdk',
      meeting_url = null,
      updated_at = now()
  where id = v_booking.id
    and (
      meeting_provider is distinct from 'zoom_video_sdk'
      or meeting_url is not null
    );

  return v_session_id;
end;
$$;
