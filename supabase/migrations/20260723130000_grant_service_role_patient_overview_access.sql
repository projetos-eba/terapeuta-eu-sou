-- Server-side patient overview queries run with service_role and still keep UI data access centralized.
grant select on public.bookings to service_role;
grant select on public.favorite_therapists to service_role;
grant select on public.conversations to service_role;
grant select on public.messages to service_role;
grant select on public.notifications to service_role;
grant select, insert, update on public.mood_checkins to service_role;
grant select on public.support_tickets to service_role;
grant select on public.reviews to service_role;
grant select on public.therapist_services to service_role;
