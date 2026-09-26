-- Adds a read-only rating filter to the Admin Reviews module. The wrapper
-- preserves every existing module and keeps filtering ahead of pagination.
do $migration$
begin
  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_module_v2_before_review_rating_filter(text,jsonb)'
  ) is not null then
    return;
  end if;

  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_module_v2(text,jsonb)'
  ) is null then
    raise exception 'ADMIN_REVIEWS_RATING_FILTER_SCHEMA_DRIFT: missing %',
      'public.admin_get_operation_module_v2(text,jsonb)' using errcode = 'P0001';
  end if;

  execute
    'alter function public.admin_get_operation_module_v2(text, jsonb) '
    'rename to admin_get_operation_module_v2_before_review_rating_filter';

  execute $definition$
create function public.admin_get_operation_module_v2(
  p_module text,
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := coalesce(nullif(btrim(p_query ->> 'sort'), ''), 'recent');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_rating smallint := case
    when coalesce(p_query ->> 'rating', '') ~ '^[1-5]$'
      then (p_query ->> 'rating')::smallint
    else null
  end;
  v_metrics jsonb;
  v_rows jsonb;
  v_total integer := 0;
begin
  -- The predecessor remains responsible for authorization and every module
  -- other than reviews. Calling it first also fails closed for invalid actors.
  v_base := public.admin_get_operation_module_v2_before_review_rating_filter(
    p_module,
    p_query
  );

  if p_module is distinct from 'reviews' then
    return v_base;
  end if;

  if v_page_text ~ '^[0-9]{1,9}$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;

  if v_page_size_text ~ '^[0-9]{1,9}$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  if v_sort not in ('recent', 'oldest', 'status', 'name') then
    v_sort := 'recent';
  end if;

  select jsonb_build_object(
    'total-reviews', count(*)::integer,
    'published-reviews', count(*) filter (
      where review.status = 'published'::public.review_status
    )::integer,
    'pending-reviews', count(*) filter (
      where review.status in (
        'pending'::public.review_status,
        'reported'::public.review_status
      )
    )::integer
  )
  into v_metrics
  from public.reviews as review;

  with filtered_reviews as (
    select
      review.id,
      review.rating,
      review.status,
      review.moderation_reason,
      review.published_at,
      review.booking_id,
      review.created_at,
      review.updated_at,
      therapist.public_name as therapist_name
    from public.reviews as review
    left join public.therapist_profiles as therapist
      on therapist.id = review.therapist_profile_id
    where (v_status is null or review.status::text = v_status)
      and (v_rating is null or review.rating = v_rating)
      and (
        v_search is null
        or lower(concat_ws(
          ' ',
          review.id::text,
          review.booking_id::text,
          review.rating::text,
          review.status::text,
          therapist.public_name
        )) like '%' || lower(v_search) || '%'
      )
  ), numbered_reviews as (
    select
      filtered_reviews.*,
      count(*) over ()::integer as total,
      row_number() over (
        order by
          case when v_sort = 'name' then lower(therapist_name) end asc nulls last,
          case when v_sort = 'status' then status::text end asc nulls last,
          case when v_sort = 'oldest' then created_at end asc,
          created_at desc,
          id desc
      )::integer as row_number
    from filtered_reviews
  ), page_reviews as (
    select *
    from numbered_reviews
    where row_number > greatest((v_page - 1) * v_page_size, 0)
      and row_number <= greatest((v_page - 1) * v_page_size, 0) + v_page_size
  )
  select
    coalesce(max(numbered_reviews.total), 0),
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', page_reviews.id,
          'rating', page_reviews.rating,
          'status', page_reviews.status,
          'moderation_reason', page_reviews.moderation_reason,
          'published_at', page_reviews.published_at,
          'therapist_name', page_reviews.therapist_name,
          'booking_id', page_reviews.booking_id,
          'created_at', page_reviews.created_at,
          'updated_at', page_reviews.updated_at
        ))
        order by page_reviews.row_number
      ) filter (where page_reviews.id is not null),
      '[]'::jsonb
    )
  into v_total, v_rows
  from numbered_reviews
  left join page_reviews on page_reviews.id = numbered_reviews.id;

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'rating', v_rating,
      'search', v_search,
      'sort', v_sort,
      'status', v_status
    ),
    'generatedAt', coalesce(v_base -> 'generatedAt', to_jsonb(now())),
    'metrics', v_metrics,
    'module', p_module,
    'page', jsonb_build_object(
      'hasNext', (v_page * v_page_size) < v_total,
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total
    ),
    'rows', v_rows
  );
end;
$$;
$definition$;
end;
$migration$;

revoke all on function
  public.admin_get_operation_module_v2_before_review_rating_filter(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_module_v2(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_operation_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_operation_module_v2(text, jsonb) is
  'Paginated Admin operation read model with a sanitized, pre-pagination review rating filter. Comments remain absent from operational rows.';
