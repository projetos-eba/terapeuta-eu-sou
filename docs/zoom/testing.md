# Testes Zoom

Unitários:

```bash
npm run test:deno -- --filter zoom
vitest run src/features/zoom
```

Esses testes cobrem pagamento canônico, booking cancelado, sala não
provisionada, janela `[startsAt - 15 min, endsAt + 30 min)`, ownership e
terapeuta suspenso. `supabase/tests/004_agenda_sessions_read_models.sql` cobre
as mesmas invariantes no read model/RLS.

Integração local:

```bash
npx supabase start
npx supabase db reset
npm run zoom:env
npm run zoom:test:webhook
npm run zoom:webhook:smoke
npm run zoom:jobs:process
npm run zoom:edge:real
```

Teste real:

```bash
ALLOW_REAL_ZOOM_TESTS=true npm run zoom:test:real
```

O teste real faz OAuth, consulta host, cria reunião de teste, consulta, atualiza, tenta ZAK, gera JWTs Meeting SDK de paciente e terapeuta, exclui e confirma `404` após cleanup. O script nunca imprime access token, Client Secret, SDK Secret, ZAK, join URL completa ou `start_url`.

## Smoke local de webhook

```bash
npm run zoom:webhook:smoke
```

O smoke local assina payloads com o secret do ambiente local, chama `/functions/v1/zoom-webhook` e valida:

- `endpoint.url_validation`;
- `meeting.started`;
- `meeting.participant_waiting`;
- `meeting.participant_joined`;
- `meeting.participant_left`;
- `meeting.ended`;
- evento desconhecido tratado como `ignored`;
- duplicidade controlada;
- JSON malformado;
- assinatura ausente/inválida;
- timestamp ausente, futuro e expirado;
- nomes Unicode e longos.

Ao final, confere efeitos no banco local e limpa os registros sintéticos.

## Fluxo real da fila e Edge Functions

```bash
ALLOW_REAL_ZOOM_TESTS=true npm run zoom:edge:real
```

Esse fluxo exige Supabase local ativo, secrets Zoom reais em `supabase/functions/.env` e `PAYMENTS_INTERNAL_OPERATIONS_TOKEN`. Ele bloqueia booking sem pagamento, enfileira criação para um booking pago de seed, chama `zoom-jobs-process` com concorrência, valida idempotência, atualiza, cancela e limpa a reunião remota.

Se o gateway local responder `404` para `zoom-jobs-process`, sirva as funções localmente em outro terminal antes do teste:

```bash
npx supabase functions serve zoom-jobs-process --env-file supabase/functions/.env --no-verify-jwt
npm run zoom:edge:real
```

## Cron e túnel

```bash
npm run zoom:cron:preflight
npm run zoom:webhook:real-preflight
npm run zoom:webhook:tunnel
```

`zoom:cron:preflight` valida o template versionado em `supabase/schedules/zoom-jobs-cron.sql`. `zoom:webhook:real-preflight` confirma o endpoint local esperado e presença de variáveis. `zoom:webhook:tunnel` abre um túnel ngrok apenas para `/functions/v1/zoom-webhook`; ele não altera o Zoom Marketplace.
