-- A profile favorite is a private, aggregate signal of interest. Its count may
-- be shown from the first completed local day; only its historical comparison
-- remains protected by the canonical sample of ten.

do $migration$
declare
  v_definition text;
  v_previous_fragment text := $source$
      'profileFavorites', public.therapist_metric_sampled_counter_v1(
        v_current_favorites,
        v_previous_favorites,
        'therapist_metrics.profile_favorites',
        'favorites',
        10
      )$source$;
  v_next_fragment text := $target$
      'profileFavorites', jsonb_build_object(
        'activity', jsonb_build_object(
          'status', case
            when v_current_favorites = 0 then 'empty'
            else 'ready'
          end,
          'unit', 'favorites',
          'value', v_current_favorites
        ),
        'comparison', public.therapist_metric_sampled_counter_v1(
          v_current_favorites,
          v_previous_favorites,
          'therapist_metrics.profile_favorites',
          'favorites',
          10
        )
      )$target$;
begin
  select pg_get_functiondef(
    'public.get_therapist_interest_metrics_v1(integer)'::regprocedure
  ) into v_definition;

  if position(v_previous_fragment in v_definition) = 0 then
    raise exception 'METRICS_INTEREST_FAVORITES_CONTRACT_NOT_FOUND';
  end if;

  execute replace(v_definition, v_previous_fragment, v_next_fragment);
end;
$migration$;

comment on function public.get_therapist_interest_metrics_v1(integer)
is 'MTR-5 private continuity read model for Premium Plus. Profile-favorite activity is aggregate-only and available from the first completed local day; comparisons, cohorts and segments retain sample locks of ten and the response contains no patient identifiers or free text.';
