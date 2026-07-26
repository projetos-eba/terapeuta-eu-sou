---
name: zoom-integration
description: Implementar e manter integração Zoom no TES com S2S OAuth, Meeting SDK, jobs, webhooks, RLS e minimização LGPD.
---

# Integração Zoom

## Fontes

1. `AGENTS.md`.
2. `docs/zoom/*.md`.
3. `docs/product/integration-map.md`.
4. `src/lib/routes.ts`.
5. `supabase/migrations/*zoom*`.
6. `supabase/functions/_shared/zoom/`.

## Arquitetura

- REST API: Zoom Server-to-Server OAuth.
- Browser: Meeting SDK Web via `@zoom/meetingsdk`.
- JWT Meeting SDK sempre no backend.
- `role=0` paciente, `role=1` terapeuta responsável.
- ZAK só para terapeuta, sob demanda e nunca persistido.
- Stripe confirma pagamento; Zoom só provisiona sala depois de `session_payments.financial_status = paid`.
- Outbox canônico: `zoom_meeting_jobs`.
- Fonte local da sala: `zoom_meetings`.

## Segurança

Nunca expor Client Secret, Account ID, access token, ZAK de paciente, webhook secret, `start_url`, `join_url` completa ou payload bruto.

Não enviar dados clínicos ao Zoom. Topic deve usar referência opaca.

## Testes

- `npm run zoom:env`
- `npm run test:deno -- --filter zoom`
- `vitest run src/features/zoom`
- `npm run zoom:test:webhook`
- `npm run zoom:webhook:smoke`
- `npm run zoom:edge:real`
- `npm run zoom:cron:preflight`
- `npm run zoom:webhook:real-preflight`
- `ALLOW_REAL_ZOOM_TESTS=true npm run zoom:test:real`

Para `zoom:edge:real`, se o gateway local responder `404` para `zoom-jobs-process`, iniciar antes:

```bash
npx supabase functions serve zoom-jobs-process --env-file supabase/functions/.env --no-verify-jwt
```

## Operação

- Cron remoto deve partir de `supabase/schedules/zoom-jobs-cron.sql` e usar Vault para o token interno.
- Ngrok local deve usar `npm run zoom:webhook:tunnel`, que apenas expõe `/functions/v1/zoom-webhook` e não altera Marketplace.
- Passcode Zoom deve permanecer com no máximo 10 caracteres.
- Eventos desconhecidos de webhook devem ser `ignored`, não erro operacional.

## Pendências Conhecidas

- Confirmar scopes exatos no Marketplace.
- Confirmar autorização do General App para ZAK/host.
- Configurar webhook remoto no Zoom Marketplace.
- Aplicar cron remoto no Supabase.
- Definir retenção legal dos eventos operacionais.
