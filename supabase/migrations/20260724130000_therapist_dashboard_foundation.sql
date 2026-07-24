-- Therapist authenticated foundation.
-- Existing equivalents are reused:
--   public.payments for booking payments
--   public.aura_recommendations for deterministic Aura recommendations

create table if not exists public.therapist_patient_relationships (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  status text not null default 'active',
  source_booking_id uuid references public.bookings (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_patient_relationships_status check (
    status in ('active', 'paused', 'closed')
  ),
  constraint therapist_patient_relationships_dates check (
    ended_at is null or ended_at >= started_at
  ),
  constraint therapist_patient_relationships_unique unique (
    therapist_profile_id,
    patient_profile_id
  )
);

create table if not exists public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  proposed_starts_at timestamptz not null,
  proposed_ends_at timestamptz not null,
  reason text,
  status text not null default 'pending',
  resolved_by_profile_id uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_reschedule_requests_status check (
    status in ('pending', 'accepted', 'rejected', 'cancelled')
  ),
  constraint booking_reschedule_requests_range check (
    proposed_starts_at < proposed_ends_at
  )
);

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  body text not null,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_replies_status check (
    status in ('draft', 'published', 'hidden')
  ),
  constraint review_replies_body_not_blank check (length(trim(body)) > 0)
);

create table if not exists public.therapist_profile_daily_analytics (
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  metric_date date not null,
  profile_views integer not null default 0,
  search_impressions integer not null default 0,
  profile_clicks integer not null default 0,
  favorites_added integer not null default 0,
  contact_clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (therapist_profile_id, metric_date),
  constraint therapist_profile_daily_analytics_non_negative check (
    profile_views >= 0
    and search_impressions >= 0
    and profile_clicks >= 0
    and favorites_added >= 0
    and contact_clicks >= 0
  )
);

create index if not exists therapist_patient_relationships_therapist_status_idx
on public.therapist_patient_relationships (therapist_profile_id, status);

create index if not exists booking_reschedule_requests_booking_status_idx
on public.booking_reschedule_requests (booking_id, status);

create index if not exists booking_reschedule_requests_requester_idx
on public.booking_reschedule_requests (requested_by_profile_id);

create index if not exists review_replies_therapist_status_idx
on public.review_replies (therapist_profile_id, status);

create index if not exists therapist_profile_daily_analytics_date_idx
on public.therapist_profile_daily_analytics (metric_date, therapist_profile_id);

create index if not exists bookings_therapist_starts_status_idx
on public.bookings (therapist_profile_id, starts_at, status);

create index if not exists payments_therapist_paid_at_status_idx
on public.payments (therapist_profile_id, paid_at, status);

create index if not exists conversations_therapist_idx
on public.conversations (therapist_profile_id);

create index if not exists notifications_profile_read_idx
on public.notifications (profile_id, read_at);

drop trigger if exists set_therapist_patient_relationships_updated_at
on public.therapist_patient_relationships;
create trigger set_therapist_patient_relationships_updated_at
before update on public.therapist_patient_relationships
for each row execute function public.set_updated_at();

drop trigger if exists set_booking_reschedule_requests_updated_at
on public.booking_reschedule_requests;
create trigger set_booking_reschedule_requests_updated_at
before update on public.booking_reschedule_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_review_replies_updated_at
on public.review_replies;
create trigger set_review_replies_updated_at
before update on public.review_replies
for each row execute function public.set_updated_at();

drop trigger if exists set_therapist_profile_daily_analytics_updated_at
on public.therapist_profile_daily_analytics;
create trigger set_therapist_profile_daily_analytics_updated_at
before update on public.therapist_profile_daily_analytics
for each row execute function public.set_updated_at();

alter table public.therapist_patient_relationships enable row level security;
alter table public.booking_reschedule_requests enable row level security;
alter table public.review_replies enable row level security;
alter table public.therapist_profile_daily_analytics enable row level security;

create or replace function public.is_current_therapist_profile(candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = candidate_id
      and therapist_profiles.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_current_patient_profile(candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = candidate_id
      and patient_profiles.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_related_patient_to_current_therapist(candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings
    join public.therapist_profiles
      on therapist_profiles.id = bookings.therapist_profile_id
    where bookings.patient_profile_id = candidate_id
      and therapist_profiles.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_current_therapist_profile(uuid) from public;
revoke all on function public.is_current_patient_profile(uuid) from public;
revoke all on function public.is_related_patient_to_current_therapist(uuid) from public;
grant execute on function public.is_current_therapist_profile(uuid) to authenticated;
grant execute on function public.is_current_patient_profile(uuid) to authenticated;
grant execute on function public.is_related_patient_to_current_therapist(uuid) to authenticated;

grant select on public.therapist_patient_relationships to authenticated;
grant select on public.booking_reschedule_requests to authenticated;
grant select on public.review_replies to authenticated;
grant select on public.therapist_profile_daily_analytics to authenticated;
grant select on public.payments to authenticated;
grant select on public.availability_rules to authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select on public.notifications to authenticated;
grant select on public.aura_recommendations to authenticated;

drop policy if exists "Therapists can read own services"
on public.therapist_services;
create policy "Therapists can read own services"
on public.therapist_services
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own availability"
on public.availability_rules;
create policy "Therapists can read own availability"
on public.availability_rules
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own bookings"
on public.bookings;
create policy "Therapists can read own bookings"
on public.bookings
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Patients can read their own bookings"
on public.bookings;
create policy "Patients can read their own bookings"
on public.bookings
for select
to authenticated
using (public.is_current_patient_profile(patient_profile_id));

drop policy if exists "Therapists can read related patients"
on public.patient_profiles;
create policy "Therapists can read related patients"
on public.patient_profiles
for select
to authenticated
using (public.is_related_patient_to_current_therapist(id));

drop policy if exists "Therapists can read own relationships"
on public.therapist_patient_relationships;
create policy "Therapists can read own relationships"
on public.therapist_patient_relationships
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own payments"
on public.payments;
create policy "Therapists can read own payments"
on public.payments
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own reviews"
on public.reviews;
create policy "Therapists can read own reviews"
on public.reviews
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own review replies"
on public.review_replies;
create policy "Therapists can read own review replies"
on public.review_replies
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own conversations"
on public.conversations;
create policy "Therapists can read own conversations"
on public.conversations
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own conversation messages"
on public.messages;
create policy "Therapists can read own conversation messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and public.is_current_therapist_profile(conversations.therapist_profile_id)
  )
);

drop policy if exists "Profiles can read own notifications"
on public.notifications;
create policy "Profiles can read own notifications"
on public.notifications
for select
to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "Participants can read related reschedule requests"
on public.booking_reschedule_requests;
create policy "Participants can read related reschedule requests"
on public.booking_reschedule_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_reschedule_requests.booking_id
      and (
        public.is_current_therapist_profile(bookings.therapist_profile_id)
        or public.is_current_patient_profile(bookings.patient_profile_id)
      )
  )
);

drop policy if exists "Therapists can read own analytics"
on public.therapist_profile_daily_analytics;
create policy "Therapists can read own analytics"
on public.therapist_profile_daily_analytics
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own Aura recommendations"
on public.aura_recommendations;
create policy "Therapists can read own Aura recommendations"
on public.aura_recommendations
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

create or replace function public.get_therapist_dashboard_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
  v_today date;
  v_month_start date;
  v_previous_month_start date;
  v_week_start date;
  v_profile_completeness integer;
  v_completed integer;
  v_no_shows integer;
begin
  select *
  into v_profile
  from public.profiles
  where id = (select auth.uid())
    and role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  select *
  into v_therapist
  from public.therapist_profiles
  where user_id = (select auth.uid())
    and plan = 'premium_plus'
    and status = 'approved';

  if not found then
    raise exception 'premium_plus_access_required' using errcode = '42501';
  end if;

  v_timezone := coalesce(
    nullif(v_therapist.metadata ->> 'timezone', ''),
    'America/Sao_Paulo'
  );
  v_today := (now() at time zone v_timezone)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_previous_month_start := (v_month_start - interval '1 month')::date;
  v_week_start := date_trunc('week', v_today::timestamp)::date;

  v_profile_completeness := (
    (
      (v_therapist.photo_url is not null)::integer
      + (v_therapist.headline is not null)::integer
      + (v_therapist.bio is not null)::integer
      + (v_therapist.city is not null)::integer
      + exists (
          select 1
          from public.therapist_services
          where therapist_profile_id = v_therapist.id
            and status = 'active'
        )::integer
    ) * 20
  );

  select
    count(*) filter (where status = 'completed'),
    count(*) filter (where status in ('no_show_patient', 'no_show_therapist'))
  into v_completed, v_no_shows
  from public.bookings
  where therapist_profile_id = v_therapist.id
    and (starts_at at time zone v_timezone)::date between v_week_start and v_week_start + 6;

  return jsonb_build_object(
    'therapist', jsonb_build_object(
      'profileId', v_therapist.id,
      'name', v_therapist.public_name,
      'avatarUrl', coalesce(v_therapist.photo_url, v_profile.avatar_url),
      'plan', v_therapist.plan,
      'profileCompleteness', v_profile_completeness
    ),
    'today', jsonb_build_object(
      'sessionsToday', (
        select count(*)
        from public.bookings
        where therapist_profile_id = v_therapist.id
          and status in ('confirmed', 'completed')
          and (starts_at at time zone v_timezone)::date = v_today
      ),
      'newConnections', (
        select count(*)
        from public.therapist_patient_relationships
        where therapist_profile_id = v_therapist.id
          and (started_at at time zone v_timezone)::date = v_today
          and source_booking_id is not null
      ),
      'pendingReviewReplies', (
        select count(*)
        from public.reviews
        where therapist_profile_id = v_therapist.id
          and status = 'published'
          and not exists (
            select 1
            from public.review_replies
            where review_replies.review_id = reviews.id
              and review_replies.status = 'published'
          )
      ),
      'reservedMinutesToday', (
        select coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0)::integer
        from public.bookings
        where therapist_profile_id = v_therapist.id
          and status in ('confirmed', 'completed')
          and (starts_at at time zone v_timezone)::date = v_today
      ),
      'pendingPayments', (
        select count(*)
        from public.bookings
        where therapist_profile_id = v_therapist.id
          and status = 'pending_payment'
      ),
      'rescheduleRequests', (
        select count(*)
        from public.booking_reschedule_requests
        join public.bookings on bookings.id = booking_reschedule_requests.booking_id
        where bookings.therapist_profile_id = v_therapist.id
          and booking_reschedule_requests.status = 'pending'
      )
    ),
    'week', jsonb_build_object(
      'rangeLabel',
        to_char(v_week_start, 'DD/MM') || ' – ' || to_char(v_week_start + 6, 'DD/MM'),
      'attendanceRate',
        case
          when v_completed + v_no_shows = 0 then 0
          else round((v_completed::numeric / (v_completed + v_no_shows)) * 100)::integer
        end,
      'days', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'date', day_value::date,
          'label', upper(to_char(day_value, 'Dy')),
          'scheduled', scheduled,
          'completed', completed,
          'cancelled', cancelled
        ) order by day_value), '[]'::jsonb)
        from (
          select
            day_value,
            count(bookings.id) filter (
              where bookings.status in ('confirmed', 'completed', 'no_show_patient', 'no_show_therapist')
            ) as scheduled,
            count(bookings.id) filter (where bookings.status = 'completed') as completed,
            count(bookings.id) filter (
              where bookings.status in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
            ) as cancelled
          from generate_series(v_week_start, v_week_start + 6, interval '1 day') day_value
          left join public.bookings
            on bookings.therapist_profile_id = v_therapist.id
            and (bookings.starts_at at time zone v_timezone)::date = day_value::date
          group by day_value
        ) weekly
      )
    ),
    'upcomingSessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bookingId', upcoming.id,
        'startsAt', upcoming.starts_at,
        'patientName', upcoming.display_name,
        'patientAvatarUrl', upcoming.avatar_url,
        'serviceTitle', upcoming.title
      ) order by upcoming.starts_at), '[]'::jsonb)
      from (
        select
          bookings.id,
          bookings.starts_at,
          patient_profiles.display_name,
          patient_profiles.avatar_url,
          therapist_services.title
        from public.bookings
        join public.patient_profiles
          on patient_profiles.id = bookings.patient_profile_id
        join public.therapist_services
          on therapist_services.id = bookings.service_id
        where bookings.therapist_profile_id = v_therapist.id
          and bookings.status = 'confirmed'
          and bookings.starts_at >= now()
        order by bookings.starts_at
        limit 4
      ) upcoming
    ),
    'kpis', jsonb_build_object(
      'monthlySessions', public.dashboard_kpi_json(
        (
          select count(*)
          from public.bookings
          where therapist_profile_id = v_therapist.id
            and (starts_at at time zone v_timezone)::date >= v_month_start
            and status not in ('draft', 'pending_payment', 'cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
        ),
        (
          select count(*)
          from public.bookings
          where therapist_profile_id = v_therapist.id
            and (starts_at at time zone v_timezone)::date >= v_previous_month_start
            and (starts_at at time zone v_timezone)::date < v_month_start
            and status not in ('draft', 'pending_payment', 'cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
        )
      ),
      'activePatients', public.dashboard_kpi_json(
        (
          select count(*)
          from public.therapist_patient_relationships
          where therapist_profile_id = v_therapist.id
            and status = 'active'
        ),
        (
          select count(*)
          from public.therapist_patient_relationships
          where therapist_profile_id = v_therapist.id
            and started_at < v_month_start
            and (ended_at is null or ended_at >= v_month_start)
        )
      ),
      'monthlyNetRevenueCents', public.dashboard_kpi_json(
        (
          select coalesce(sum(therapist_amount_cents), 0)
          from public.payments
          where therapist_profile_id = v_therapist.id
            and status = 'paid'
            and (paid_at at time zone v_timezone)::date >= v_month_start
        ),
        (
          select coalesce(sum(therapist_amount_cents), 0)
          from public.payments
          where therapist_profile_id = v_therapist.id
            and status = 'paid'
            and (paid_at at time zone v_timezone)::date >= v_previous_month_start
            and (paid_at at time zone v_timezone)::date < v_month_start
        )
      ),
      'profileViews', public.dashboard_kpi_json(
        (
          select coalesce(sum(profile_views), 0)
          from public.therapist_profile_daily_analytics
          where therapist_profile_id = v_therapist.id
            and metric_date >= v_month_start
        ),
        (
          select coalesce(sum(profile_views), 0)
          from public.therapist_profile_daily_analytics
          where therapist_profile_id = v_therapist.id
            and metric_date >= v_previous_month_start
            and metric_date < v_month_start
        )
      )
    ),
    'attentionItems', (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', 'pending-payments',
          'count', (
            select count(*)
            from public.bookings
            where therapist_profile_id = v_therapist.id
              and status = 'pending_payment'
          ),
          'label', 'Pagamentos pendentes',
          'href', '/plus/sessoes',
          'tone', 'warning'
        ) as item
        where exists (
          select 1 from public.bookings
          where therapist_profile_id = v_therapist.id
            and status = 'pending_payment'
        )
        union all
        select jsonb_build_object(
          'id', 'reschedule-requests',
          'count', (
            select count(*)
            from public.booking_reschedule_requests
            join public.bookings on bookings.id = booking_reschedule_requests.booking_id
            where bookings.therapist_profile_id = v_therapist.id
              and booking_reschedule_requests.status = 'pending'
          ),
          'label', 'Pedidos de reagendamento',
          'href', '/plus/agenda',
          'tone', 'warning'
        ) as item
        where exists (
          select 1
          from public.booking_reschedule_requests
          join public.bookings on bookings.id = booking_reschedule_requests.booking_id
          where bookings.therapist_profile_id = v_therapist.id
            and booking_reschedule_requests.status = 'pending'
        )
        union all
        select jsonb_build_object(
          'id', 'profile-completeness',
          'label', 'Perfil ' || v_profile_completeness || '% concluído',
          'href', '/plus/perfil',
          'tone', 'info'
        ) as item
        where v_profile_completeness < 100
      ) attention
    ),
    'history', jsonb_build_object(
      'completedSessions', (
        select count(*)
        from public.bookings
        where therapist_profile_id = v_therapist.id
          and status = 'completed'
      ),
      'activePatients', (
        select count(*)
        from public.therapist_patient_relationships
        where therapist_profile_id = v_therapist.id
          and status = 'active'
      ),
      'averageRating', (
        select round(avg(rating), 1)
        from public.reviews
        where therapist_profile_id = v_therapist.id
          and status = 'published'
      )
    ),
    'recentReviews', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'patientName', recent.display_name,
        'patientInitial', left(recent.display_name, 1),
        'rating', recent.rating,
        'comment', recent.comment,
        'publishedAt', recent.published_at
      ) order by recent.published_at desc), '[]'::jsonb)
      from (
        select
          reviews.id,
          patient_profiles.display_name,
          reviews.rating,
          coalesce(reviews.comment, '') as comment,
          reviews.published_at
        from public.reviews
        join public.patient_profiles
          on patient_profiles.id = reviews.patient_profile_id
        where reviews.therapist_profile_id = v_therapist.id
          and reviews.status = 'published'
        order by reviews.published_at desc
        limit 3
      ) recent
    ),
    'unreadMessagesCount', (
      select count(*)
      from public.messages
      join public.conversations on conversations.id = messages.conversation_id
      where conversations.therapist_profile_id = v_therapist.id
        and messages.sender_profile_id <> (select auth.uid())
        and messages.read_at is null
    ),
    'unreadNotificationsCount', (
      select count(*)
      from public.notifications
      where profile_id = (select auth.uid())
        and read_at is null
    )
  );
end;
$$;

create or replace function public.dashboard_kpi_json(
  current_value numeric,
  previous_value numeric
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'value', coalesce(current_value, 0),
    'trend', jsonb_build_object(
      'direction',
        case
          when coalesce(current_value, 0) > coalesce(previous_value, 0) then 'up'
          when coalesce(current_value, 0) < coalesce(previous_value, 0) then 'down'
          else 'flat'
        end,
      'percent',
        case
          when coalesce(previous_value, 0) = 0
            then case when coalesce(current_value, 0) = 0 then 0 else null end
          else round(abs((current_value - previous_value) / previous_value) * 100)
        end
    )
  );
$$;

revoke all on function public.dashboard_kpi_json(numeric, numeric) from public;
grant execute on function public.dashboard_kpi_json(numeric, numeric) to authenticated;
revoke all on function public.get_therapist_dashboard_v1() from public;
grant execute on function public.get_therapist_dashboard_v1() to authenticated;

comment on function public.get_therapist_dashboard_v1() is
  'Premium Plus therapist dashboard read model. Resolves auth.uid(), uses RLS and returns aggregate/private-safe data.';
