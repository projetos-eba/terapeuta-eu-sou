-- Terminal deliveries must not retain a dispatch schedule. This makes the
-- persisted state unambiguous for operations while the claim query remains
-- restricted to pending and retryable work.

alter table public.email_outbox
  alter column next_attempt_at drop not null;

update public.email_outbox
set next_attempt_at = null
where status not in ('pending', 'retry_pending')
  and next_attempt_at is not null;

alter table public.email_outbox
  drop constraint if exists email_outbox_next_attempt_state_check,
  add constraint email_outbox_next_attempt_state_check check (
    (status in ('pending', 'retry_pending') and next_attempt_at is not null)
    or (status in ('processing', 'delivered', 'skipped', 'dead') and next_attempt_at is null)
  );

create or replace function public.claim_email_outbox_v1(
  p_worker_id uuid,
  p_limit integer default 10
)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or p_limit < 1 or p_limit > 50 then
    raise exception 'EMAIL_OUTBOX_INVALID_CLAIM';
  end if;

  update public.email_outbox
  set
    status = 'dead',
    review_required = true,
    review_reason = 'delivery_outcome_unknown',
    last_error = 'delivery_outcome_unknown',
    next_attempt_at = null,
    processed_at = now(),
    locked_at = null,
    locked_by = null
  where status = 'processing'
    and locked_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select id
    from public.email_outbox
    where status in ('pending', 'retry_pending')
      and next_attempt_at <= now()
    order by next_attempt_at, created_at
    limit p_limit
    for update skip locked
  )
  update public.email_outbox outbox
  set
    status = 'processing',
    attempts = outbox.attempts + 1,
    next_attempt_at = null,
    locked_at = now(),
    locked_by = p_worker_id
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_email_outbox_v1(
  p_outbox_id uuid,
  p_worker_id uuid,
  p_outcome public.email_outbox_status,
  p_last_error text default null,
  p_review_required boolean default false,
  p_review_reason text default null
)
returns public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.email_outbox;
begin
  if p_outcome not in ('delivered', 'skipped', 'retry_pending', 'dead') then
    raise exception 'EMAIL_OUTBOX_INVALID_OUTCOME';
  end if;

  update public.email_outbox
  set
    status = case
      when p_outcome = 'retry_pending' and attempts >= 5 then 'dead'::public.email_outbox_status
      else p_outcome
    end,
    next_attempt_at = case
      when p_outcome = 'retry_pending' and attempts < 5 then
        now() + make_interval(secs => least(3600, 30 * power(2, attempts - 1)::integer))
      else null
    end,
    last_error = nullif(regexp_replace(coalesce(p_last_error, ''), '[\r\n]+', ' ', 'g'), '')::text,
    review_required = p_review_required or (p_outcome = 'retry_pending' and attempts >= 5),
    review_reason = case
      when p_review_required then nullif(regexp_replace(coalesce(p_review_reason, ''), '[\r\n]+', ' ', 'g'), '')::text
      when p_outcome = 'retry_pending' and attempts >= 5 then 'retry_limit_exhausted'
      else null
    end,
    locked_at = null,
    locked_by = null,
    processed_at = case
      when p_outcome in ('delivered', 'skipped', 'dead') or attempts >= 5 then now()
      else null
    end
  where id = p_outbox_id
    and status = 'processing'
    and locked_by = p_worker_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'EMAIL_OUTBOX_CLAIM_LOST';
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_email_outbox_v1(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_email_outbox_v1(
  uuid,
  uuid,
  public.email_outbox_status,
  text,
  boolean,
  text
) from public, anon, authenticated;
grant execute on function public.claim_email_outbox_v1(uuid, integer)
  to service_role;
grant execute on function public.complete_email_outbox_v1(
  uuid,
  uuid,
  public.email_outbox_status,
  text,
  boolean,
  text
) to service_role;
