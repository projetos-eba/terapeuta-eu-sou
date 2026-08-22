-- All therapist plans may publish as many services as they need.
-- The function remains as a compatibility contract for existing read models;
-- a NULL limit means that no plan-level count is enforced.
create or replace function public.therapist_service_limit_for_plan_v1(
  p_plan public.therapist_plan
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select null::integer;
$$;

comment on function public.therapist_service_limit_for_plan_v1(public.therapist_plan)
  is 'Compatibility read-model contract: therapist services are unlimited for every plan.';
