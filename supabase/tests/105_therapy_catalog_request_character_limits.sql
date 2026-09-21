begin;

select plan(3);

select lives_ok(
  $test$
    do $block$
    declare
      v_actor_id uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
      v_theme_ids jsonb;
      v_payload jsonb;
    begin
      select jsonb_agg(id)
      into v_theme_ids
      from (
        select id
        from public.matching_themes
        where is_active
        order by sort_order, name, id
        limit 1
      ) as active_theme;

      v_payload := jsonb_build_object(
        'informedName', repeat('n', 30),
        'themeIds', v_theme_ids,
        'submission', jsonb_build_object(
          'aliases', repeat('a', 80),
          'description', repeat('d', 600),
          'objective', repeat('o', 180),
          'useCases', repeat('u', 600),
          'sessionProcess', repeat('p', 800),
          'trainingDescription', repeat('t', 120),
          'practiceDuration', repeat('r', 50),
          'safetyNotes', repeat('s', 600),
          'referenceUrl', repeat('f', 500),
          'additionalInformation', repeat('i', 500)
        )
      );

      perform public.submit_therapy_catalog_request_v2(
        v_actor_id,
        v_payload,
        '10500000-0000-4000-8000-000000000001'
      );
    end
    $block$;
  $test$,
  'submission accepts every text field at its maximum length'
);

select lives_ok(
  $test$
    do $block$
    declare
      v_actor_id uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
      v_theme_ids jsonb;
      v_payload jsonb;
      v_field text;
      v_limit integer;
      v_rejected boolean;
    begin
      select jsonb_agg(id)
      into v_theme_ids
      from (
        select id
        from public.matching_themes
        where is_active
        order by sort_order, name, id
        limit 1
      ) as active_theme;

      for v_field, v_limit in
        select * from unnest(
          array[
            'informedName', 'aliases', 'description', 'objective', 'useCases',
            'sessionProcess', 'trainingDescription', 'practiceDuration',
            'safetyNotes', 'referenceUrl', 'additionalInformation'
          ]::text[],
          array[30, 80, 600, 180, 600, 800, 120, 50, 600, 500, 500]
        )
      loop
        v_payload := jsonb_build_object(
          'informedName', 'Terapia válida',
          'themeIds', v_theme_ids,
          'submission', jsonb_build_object(
            'aliases', 'Nome alternativo', 'description', 'Descrição responsável.',
            'objective', 'Objetivo informado.', 'useCases', 'Situações relatadas.',
            'sessionProcess', 'Processo explicado.', 'trainingDescription', 'Formação',
            'practiceDuration', 'Dois anos', 'safetyNotes', 'Sem cuidados adicionais.',
            'referenceUrl', 'Referência válida', 'additionalInformation', 'Informação adicional.'
          )
        );
        if v_field = 'informedName' then
          v_payload := jsonb_set(v_payload, '{informedName}', to_jsonb(repeat('x', v_limit + 1)));
        else
          v_payload := jsonb_set(v_payload, array['submission', v_field], to_jsonb(repeat('x', v_limit + 1)));
        end if;

        v_rejected := false;
        begin
          perform public.submit_therapy_catalog_request_v2(v_actor_id, v_payload, gen_random_uuid());
        exception when others then
          if sqlstate = 'P0001' and sqlerrm = 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD' then
            v_rejected := true;
          else
            raise;
          end if;
        end;
        if not v_rejected then
          raise exception 'submission accepted an over-limit % field', v_field;
        end if;
      end loop;
    end
    $block$;
  $test$,
  'submission rejects every text field above its maximum length'
);

select lives_ok(
  $test$
    do $block$
    declare
      v_actor_id uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
      v_theme_ids jsonb;
      v_payload jsonb;
      v_catalog_request_id uuid;
      v_field text;
      v_limit integer;
      v_rejected boolean;
    begin
      select jsonb_agg(id)
      into v_theme_ids
      from (
        select id
        from public.matching_themes
        where is_active
        order by sort_order, name, id
        limit 1
      ) as active_theme;

      v_payload := jsonb_build_object(
        'informedName', 'Terapia para reenvio',
        'themeIds', v_theme_ids,
        'submission', jsonb_build_object(
          'description', 'Descrição responsável.', 'objective', 'Objetivo informado.',
          'useCases', 'Situações relatadas.', 'sessionProcess', 'Processo explicado.'
        )
      );
      v_catalog_request_id := (public.submit_therapy_catalog_request_v2(
        v_actor_id, v_payload, '10500000-0000-4000-8000-000000000002'
      ) ->> 'requestId')::uuid;
      update public.therapy_catalog_requests
      set status = 'needs_information'
      where id = v_catalog_request_id;

      for v_field, v_limit in
        select * from unnest(
          array[
            'informedName', 'aliases', 'description', 'objective', 'useCases',
            'sessionProcess', 'trainingDescription', 'practiceDuration',
            'safetyNotes', 'referenceUrl', 'additionalInformation'
          ]::text[],
          array[30, 80, 600, 180, 600, 800, 120, 50, 600, 500, 500]
        )
      loop
        v_payload := jsonb_build_object(
          'informedName', 'Terapia válida',
          'themeIds', v_theme_ids,
          'submission', jsonb_build_object(
            'aliases', 'Nome alternativo', 'description', 'Descrição responsável.',
            'objective', 'Objetivo informado.', 'useCases', 'Situações relatadas.',
            'sessionProcess', 'Processo explicado.', 'trainingDescription', 'Formação',
            'practiceDuration', 'Dois anos', 'safetyNotes', 'Sem cuidados adicionais.',
            'referenceUrl', 'Referência válida', 'additionalInformation', 'Informação adicional.'
          )
        );
        if v_field = 'informedName' then
          v_payload := jsonb_set(v_payload, '{informedName}', to_jsonb(repeat('x', v_limit + 1)));
        else
          v_payload := jsonb_set(v_payload, array['submission', v_field], to_jsonb(repeat('x', v_limit + 1)));
        end if;

        v_rejected := false;
        begin
          perform public.resubmit_therapy_catalog_request_v2(
            v_actor_id, v_catalog_request_id, v_payload, gen_random_uuid()
          );
        exception when others then
          if sqlstate = 'P0001' and sqlerrm = 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD' then
            v_rejected := true;
          else
            raise;
          end if;
        end;
        if not v_rejected then
          raise exception 'resubmission accepted an over-limit % field', v_field;
        end if;
      end loop;
    end
    $block$;
  $test$,
  'resubmission rejects every text field above its maximum length'
);

select * from finish();
rollback;
