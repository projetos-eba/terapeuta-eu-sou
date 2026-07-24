# Auditoria de Variaveis Supabase

Data: 2026-07-24

Referencias oficiais Supabase:

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

## Regra

O `.env.example` da raiz representa o ambiente do app Next.js e deve conter
somente variaveis publicaveis com prefixo `NEXT_PUBLIC_`.

Para Supabase, a preferencia atual e:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como unica chave publica Supabase
  aceita pelo app Next.js.

Nunca adicionar ao ambiente do front-end:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- `SERVICE_ROLE_KEY`
- `DATABASE_URL`
- qualquer outro secret nao publico do Supabase

Secrets nao publicos do Supabase devem ficar no escopo de Supabase Edge
Functions. Use `SUPABASE_SECRET_KEYS` para operacoes administrativas com as
novas API keys. Os exemplos documentais ficam em
`supabase/functions/.env.example`. No Supabase local, a CLI injeta variaveis do
projeto automaticamente ao iniciar o ambiente local e executar functions.

## Varredura local

Comando base executado:

```bash
rg -n --hidden -g '!node_modules/**' -g '!.git/**' -g '!package-lock.json' "SUPABASE_|SERVICE_ROLE|JWT_SECRET|DATABASE_URL" . -S
```

Resultado funcional:

- `.env.example` tinha `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_JWT_SECRET`.
  Esses exemplos foram removidos da raiz.
- Supabase Edge Functions preferem `SUPABASE_SECRET_KEYS` via `Deno.env` para
  operacoes administrativas. `SUPABASE_SERVICE_ROLE_KEY` permanece aceito
  somente dentro das functions porque o Edge Runtime local atual ainda injeta
  essa variavel padrao.
- `SUPABASE_JWT_SECRET` nao foi encontrado em codigo de runtime do app Next.js.
- Nao foi identificado uso de `SUPABASE_SERVICE_ROLE_KEY` em Client Components.
  Nao ha diretivas `"use client"` nos arquivos analisados.
- Apos os ajustes, `src/` nao contem uso de `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` ou `SERVICE_ROLE_KEY`.

## Pontos migrados para fronteira sem secret no Next

Os pontos abaixo usavam ou dependiam de service role no runtime server-side do
Next.js. Foram ajustados para usar Edge Functions ou token autenticado com RLS:

- `src/lib/supabase/public-config.ts`: centraliza `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `src/features/client-auth/supabase-rest.ts`: cadastro via
  `supabase/functions/client-auth-signup`; login com anon/publishable e token
  do usuario.
- `src/features/therapist-auth/supabase-rest.ts`: cadastro via
  `supabase/functions/therapist-auth-signup`; login com anon/publishable e
  token do usuario.
- `src/features/public-matching/supabase.ts`: calculo com pesos internos via
  `supabase/functions/matching-calculate`; fallback local sem secret quando a
  function nao estiver disponivel.
- `src/features/patient-overview/patient-overview.queries.ts`: leitura e
  escrita com token do paciente e RLS.
- `src/features/patient-encounters/patient-encounters.queries.ts`: leitura com
  token do paciente e RLS.
- `supabase/migrations/20260724103000_patient_authenticated_rls_reads.sql`:
  grants/policies aditivas para preservar as telas autenticadas do paciente sem
  service role no app Next.
- `supabase/migrations/20260724110000_grant_edge_matching_calculation_access.sql`:
  grant de leitura apenas para `service_role` nas tabelas internas usadas pela
  Edge Function de calculo do Match.
- `supabase/migrations/20260724111500_optimize_authenticated_rls_uid_calls.sql`:
  recriacao das policies autenticadas tocadas usando `(select auth.uid())`,
  conforme recomendacao de performance do advisor Supabase.
- `supabase/seed.sql`: usuarios mockados de Auth foram normalizados para o
  schema local atual do GoTrue e receberam `auth.identities` idempotentes, para
  validar login real apos `supabase db reset`.

Rotas/fluxos afetados:

- `POST /api/auth/client/signup`
- `POST /api/auth/therapist/signup`
- `POST /api/public/matching/calculate`
- paginas autenticadas de paciente que carregam visao geral e encontros

## Recomendacao tecnica

Manter operacoes que precisam de service role/secret key em Supabase Edge
Functions ou em endpoints de backend que nao compartilhem o ambiente do app
Next.js.

Para o front-end Next.js:

- manter somente `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para leituras publicas seguras;
- usar RLS e token de usuario para dados autenticados sempre que possivel;
- chamar Edge Functions para operacoes administrativas;
- nunca depender de `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`,
  `SUPABASE_SECRET_KEY` ou `SUPABASE_JWT_SECRET` no `.env.local`,
  `.env.production` ou `.env.example` da raiz.
