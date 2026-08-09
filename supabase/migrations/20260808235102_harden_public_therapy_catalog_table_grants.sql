-- H1 hardening: public therapy catalog tables are readable through explicit
-- projections, but browser roles must not hold table mutation or DDL privileges.

revoke all on table
  public.therapies,
  public.therapy_categories,
  public.therapy_public_content,
  public.therapy_highlights,
  public.therapy_benefits,
  public.therapy_faqs
from public, anon, authenticated, service_role;

grant select on table
  public.therapies,
  public.therapy_categories
to anon, authenticated, service_role;

grant select on table
  public.therapy_public_content,
  public.therapy_highlights,
  public.therapy_benefits,
  public.therapy_faqs
to authenticated, service_role;
