-- H1 hardening: public home testimonials must use explicit public review
-- grants/RLS, not view-owner bypass.

revoke all on public.reviews
from public, anon;

revoke insert, update, delete, truncate, references, trigger
on public.reviews
from authenticated;

grant select (
  id,
  comment,
  rating,
  status,
  published_at,
  created_at
) on public.reviews to anon;

drop policy if exists "Public can read published testimonial reviews"
  on public.reviews;
create policy "Public can read published testimonial reviews"
on public.reviews
for select
to anon
using (
  status = 'published'::public.review_status
  and comment is not null
  and length(trim(comment)) >= 24
);

create or replace view public.public_home_testimonials
with (security_invoker = true) as
select
  reviews.id,
  'Paciente TES'::text as author_name,
  reviews.comment as body,
  'Depoimento publicado'::text as context_label,
  reviews.rating,
  reviews.published_at,
  reviews.created_at
from public.reviews
where reviews.status = 'published'::public.review_status
  and reviews.comment is not null
  and length(trim(reviews.comment)) >= 24;

revoke all on public.public_home_testimonials
from public, anon, authenticated, service_role;

grant select on public.public_home_testimonials
to anon, authenticated, service_role;

comment on view public.public_home_testimonials is
  'Public home testimonial DTO. Runs as security_invoker and exposes only published, sufficiently descriptive review comments.';
