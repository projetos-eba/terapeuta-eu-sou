-- Operational attempts and private quality reports are independent of money.
begin;

create table public.booking_session_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  booking_version integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  timezone text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, sequence)
);
create index booking_session_attempts_current_idx
  on public.booking_session_attempts (booking_id, sequence desc);

create function public.current_session_attempt_id_v1(p_booking_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select attempt.id from public.booking_session_attempts attempt
  where attempt.booking_id = p_booking_id order by sequence desc limit 1;
$$;

create function public.record_booking_session_attempt_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then return new; end if;
  insert into public.booking_session_attempts
    (booking_id, sequence, booking_version, starts_at, ends_at, timezone)
  select new.id, coalesce(max(sequence), 0) + 1, new.version,
    new.starts_at, new.ends_at, new.timezone
  from public.booking_session_attempts where booking_id = new.id;
  return new;
end;
$$;
create trigger record_booking_session_attempt
after insert or update of starts_at, ends_at, timezone on public.bookings
for each row execute function public.record_booking_session_attempt_v1();

-- Existing bookings get a current snapshot, not an invented past history.
insert into public.booking_session_attempts
  (booking_id, sequence, booking_version, starts_at, ends_at, timezone)
select id, 1, version, starts_at, ends_at, timezone from public.bookings;

alter table public.video_session_participations add column session_attempt_id uuid
  references public.booking_session_attempts(id) on delete restrict;
alter table public.session_participant_confirmations add column session_attempt_id uuid
  references public.booking_session_attempts(id) on delete restrict;
alter table public.session_confirmation_incidents add column session_attempt_id uuid
  references public.booking_session_attempts(id) on delete restrict;

alter table public.session_participant_confirmations
  drop constraint session_participant_confirmations_participant_key;
create unique index session_participant_confirmations_attempt_role_uidx
  on public.session_participant_confirmations(session_attempt_id, participant_role)
  where session_attempt_id is not null;
create unique index session_participant_confirmations_legacy_role_uidx
  on public.session_participant_confirmations(booking_id, participant_role)
  where session_attempt_id is null;

create function public.bind_session_attempt_evidence_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_attempt public.booking_session_attempts; v_time timestamptz;
begin
  select * into v_attempt from public.booking_session_attempts
    where id = public.current_session_attempt_id_v1(new.booking_id);
  if tg_table_name = 'video_session_participations' then
    v_time := coalesce(new.joined_at, new.created_at);
    if new.session_attempt_id is null and v_time between
      greatest(v_attempt.starts_at - interval '15 minutes',
        case when v_attempt.sequence = 1 then '-infinity'::timestamptz else v_attempt.created_at end)
      and v_attempt.ends_at then new.session_attempt_id := v_attempt.id; end if;
  elsif tg_table_name = 'booking_events' then
    if new.event_type = 'zoom_waiting_room_entered'
      and new.payload ->> 'bookingVersion' =
        (select version::text from public.bookings where id = new.booking_id)
      and (new.payload ->> 'scheduledStartsAt')::timestamptz = v_attempt.starts_at
    then new.payload := new.payload || jsonb_build_object('sessionAttemptId', v_attempt.id); end if;
  end if;
  return new;
end;
$$;
create trigger bind_session_attempt_participation before insert on public.video_session_participations
for each row execute function public.bind_session_attempt_evidence_v1();
create trigger bind_session_attempt_arrival before insert on public.booking_events
for each row execute function public.bind_session_attempt_evidence_v1();

-- Retain unversioned historical confirmations. Only independently provable
-- evidence may be attached to the snapshot imported above.
update public.video_session_participations participation
set session_attempt_id = attempt.id
from public.booking_session_attempts attempt
join public.bookings booking on booking.id = attempt.booking_id
where participation.booking_id = attempt.booking_id
  and participation.event_type = 'session.user_joined'
  and coalesce(participation.joined_at, participation.created_at)
    between attempt.starts_at - interval '15 minutes' and attempt.ends_at
  and not exists (select 1 from public.booking_events event
    where event.booking_id = booking.id and event.event_type = 'booking_rescheduled'
      and event.created_at > coalesce(participation.joined_at, participation.created_at));
update public.booking_events event set payload = event.payload ||
  jsonb_build_object('sessionAttemptId', attempt.id)
from public.booking_session_attempts attempt join public.bookings booking on booking.id = attempt.booking_id
where event.booking_id = booking.id and event.event_type = 'zoom_waiting_room_entered'
  and event.payload ->> 'bookingVersion' = case
    when booking.status in ('no_show_patient','no_show_therapist','no_show_both')
      then (booking.version - 1)::text else booking.version::text end
  and (event.payload ->> 'scheduledStartsAt')::timestamptz = attempt.starts_at;
update public.session_confirmation_incidents incident set session_attempt_id = attempt.id
from public.booking_session_attempts attempt join public.bookings booking on booking.id = attempt.booking_id
where incident.booking_id = booking.id and incident.booking_version = case
  when booking.status in ('no_show_patient','no_show_therapist','no_show_both')
    then booking.version - 1 else booking.version end;

create table public.session_quality_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  session_attempt_id uuid not null references public.booking_session_attempts(id) on delete restrict,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  author_role public.user_role not null check (author_role in ('patient','therapist')),
  successful boolean not null,
  rating smallint,
  quality_reason text,
  comment text not null default '' check (char_length(comment) <= 500),
  request_id uuid not null unique,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (session_attempt_id, author_role),
  check ((successful and rating between 1 and 5 and rating is not null and quality_reason is null)
    or (not successful and rating is null and quality_reason is not null
      and quality_reason in ('internet_problem','audio_video_problem','other')))
);
create table public.session_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.session_quality_feedback(id) on delete restrict,
  session_attempt_id uuid not null references public.booking_session_attempts(id) on delete restrict,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  ticket_id uuid not null unique references public.support_tickets(id) on delete restrict,
  opened_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '5 days'),
  answered_at timestamptz,
  response_message_id uuid references public.support_ticket_messages(id) on delete restrict
);
create index session_quality_reviews_unanswered_idx
  on public.session_quality_reviews(session_attempt_id, due_at) where answered_at is null;

alter table public.booking_session_attempts enable row level security;
alter table public.session_quality_feedback enable row level security;
alter table public.session_quality_reviews enable row level security;
revoke all on public.booking_session_attempts, public.session_quality_feedback,
  public.session_quality_reviews from public, anon, authenticated;
grant select on public.booking_session_attempts, public.session_quality_feedback,
  public.session_quality_reviews to authenticated;
grant all on public.booking_session_attempts, public.session_quality_feedback,
  public.session_quality_reviews to service_role;
create policy "Participants read attempt snapshots" on public.booking_session_attempts
for select to authenticated using (exists (
  select 1 from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = booking_id and (patient.user_id = auth.uid() or therapist.user_id = auth.uid())
) or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Author or Admin reads private quality" on public.session_quality_feedback
for select to authenticated using (author_profile_id = auth.uid() or exists (
  select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Requester or Admin reads quality review" on public.session_quality_reviews
for select to authenticated using (requester_profile_id = auth.uid() or exists (
  select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create function public.complete_session_quality_review_on_reply_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.author_role = 'admin' and new.visibility = 'requester' and exists (
    select 1 from public.profiles where id = new.author_profile_id and role = 'admin'
      and auth_deleted_at is null and anonymized_at is null
  ) then
    update public.session_quality_reviews set answered_at = new.created_at,
      response_message_id = new.id
    where ticket_id = new.ticket_id and answered_at is null;
  end if;
  return new;
end;
$$;
create trigger complete_session_quality_review_on_reply
after insert on public.support_ticket_messages for each row
execute function public.complete_session_quality_review_on_reply_v1();

revoke all on function public.current_session_attempt_id_v1(uuid),
  public.record_booking_session_attempt_v1(), public.bind_session_attempt_evidence_v1(),
  public.complete_session_quality_review_on_reply_v1() from public, anon, authenticated;
grant execute on function public.current_session_attempt_id_v1(uuid) to service_role;
commit;
