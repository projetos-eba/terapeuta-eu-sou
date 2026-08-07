# Terapeuta Eu Sou

Projeto web em Next.js 15, React 18, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES em CSS Variables.

O backend usa Supabase Postgres, Auth, RLS e Edge Functions. O app Next.js
consome superfícies REST/RPC autenticadas e publicáveis sem service role; não
há dependência do SDK `@supabase/supabase-js` no frontend atual.

A home pública (`/`) consulta views públicas Supabase via REST quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estão configuradas. Sem essas variáveis, ou com valores placeholder, a página usa fallback local e continua renderizando sem expor segredos.

A página pública `/para-terapeutas` usa o catálogo único de planos em `src/domain/tes/plan-definitions.ts`. Os `stripePriceId` permanecem `null`; o frontend envia somente o código do plano (`free`, `premium`, `premium_plus`) no cadastro. Contas pagas seguem para `/terapeuta/checkout`, iniciam Stripe Checkout via Edge Function e permanecem com plano ativo `free` até confirmação por webhook Stripe.

O fluxo inicial de terapeuta usa `/terapeuta/cadastro`, `/terapeuta/login` e `/terapeuta/checkout`. O cadastro chama uma Supabase Edge Function para as operações administrativas de Auth/Admin, sem expor service role no app Next.js. Free segue ao login; Premium e Premium Plus recebem sessão e seguem ao resumo de checkout. Sem a function configurada, as telas renderizam e o submit retorna erro controlado.

A área autenticada do terapeuta tem `/terapeuta/*` como namespace canônico
aprovado. O plural `/terapeutas/*` continua reservado à busca e ao perfil
público. `/basico/*`, `/pro/*` e `/plus/*` respondem apenas com redirects
temporários para a rota equivalente. Plano e capability são validados pela
sessão autenticada, nunca pelo prefixo da URL.

A home autenticada `/terapeuta` mostra um painel de primeiros passos para
terapeutas novos, Free, Premium ou com perfil ainda não aprovado. O dashboard
operacional completo é carregado somente para Premium Plus com
`therapist_profiles.status = approved`; erros de infraestrutura continuam sendo
exibidos como indisponibilidade honesta.

O fluxo inicial de cliente usa rotas separadas em `/cliente/cadastro` e `/cliente/login`. O cadastro também usa Supabase Auth/Admin via REST server-side, cria `profiles.role = patient` e `patient_profiles`; documentos, verificação profissional e dados bancários não fazem parte do cadastro de cliente.

O Match público usa `/sua-jornada` e `/sua-jornada/resultado`. A configuração vem de `matching_themes`, `matching_interests` e da view `public_matching_config`; o cálculo roda em `/api/public/matching/calculate` com pesos versionados em `matching_weights`, usando apenas a versão publicada. O fluxo é anônimo, usa `sessionStorage` para escolhas temporárias e recomenda terapias, não terapeutas.

O catálogo público de terapias usa `/terapias` e `/api/public/therapies`, consultando a view segura `public_therapies_v` por REST Supabase com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A view expõe apenas terapias com `status = published`, visíveis publicamente e vinculadas a categorias ativas, com contagem pública de terapeutas disponíveis. O detalhe `/terapias/:slug` usa `public_therapy_details_v` para conteúdo editorial e `public_therapist_search` para profissionais relacionados. O Match usa `matching_therapy_settings.is_visible_in_matching` como ativação adicional; uma terapia só entra no Match se também estiver publicada.

O glossário canônico fica em `docs/product/glossary.md`. Pacientes veem
“Encontro”; terapeuta/admin mantêm “Sessão” para operação; domínio técnico
preserva `session` e `booking`. Planos comerciais são Free, Premium e Premium
Plus. A área `/terapeuta/servicos` usa o label amigável “Suas terapias”, mas o
domínio técnico continua `therapist_services`.

A fundação canônica de Terapias da Plataforma x Serviços do Terapeuta está em
`docs/architecture/therapy-service-foundation-phase1.md` e
`docs/architecture/adr/ADR-008-platform-therapy-service-boundary.md`.
Terapeutas não criam terapias por texto livre: o shell deve usar
`/api/therapist/services`, que chama a Edge Function
`therapist-services-command` e as RPCs transacionais de serviço. Toda criação
exige `therapyId`, `requestId` UUID idempotente e validação server-side de
terapia, categoria, plano e duplicidade.

O TES opera exclusivamente online. Campos técnicos legados de formato permanecem
por compatibilidade, mas criação, edição, agenda, reserva, perfil público e
sessões devem aceitar e expor somente `online`.

A gestão de serviços no shell está implementada em `/terapeuta/servicos`,
seguindo o Figma `13366:1943` com layout responsivo, criação em 3 passos,
edição, ativação, pausa, arquivamento, reordenação, filtros e limite por plano.
`/terapeuta/servicos/meus` redireciona para a rota canônica. A tela consome
somente os contratos da Fase 1 e não exibe métricas fictícias.

O Meu Perfil do terapeuta está implementado com `/terapeuta/perfil` como tela
preview-first da versão publicada, seguindo o Figma `13366:2408`, e
`/terapeuta/perfil/editar` como tela complementar de edição, seguindo o Figma
`13366:7289`. A fonte canônica permanece `therapist_profiles`; rascunhos ficam
em `therapist_profile_content_versions`, publicação é feita pelo terapeuta via
`therapist-profile-command`, dados derivados são somente leitura, mídia pública usa
`/api/therapist/profile/media` e documentos privados usam tabela/bucket
separados. Publicações podem levar até 2 a 3 horas para refletir em todas as
superfícies públicas.

A página de Avaliações do terapeuta está implementada em
`/terapeuta/avaliacoes`, seguindo o Figma `13366:5844`. Ela usa o read model
privado `get_therapist_reviews_v1`, permite responder avaliações publicadas de
sessões online pagas e concluídas por `upsert_therapist_review_reply_v1`, e
sincroniza respostas publicadas com `public_therapist_profile_reviews_v` para
`/terapeutas/:slug` sem expor dados administrativos ou privados.

MTR-1 a MTR-5 e o corte CSV de MTR-7 de Métricas & Relatórios estão
implementados em
`/terapeuta/insights`, seguindo a hierarquia do Figma `13366:3628`. O read
model privado `get_therapist_metrics_overview_v1` oferece períodos de 30 ou 90
dias completos, três contadores operacionais, série de sessões, descoberta,
funil por coorte, favoritos do perfil e ranking das próprias terapias. A
aba Sessões usa `get_therapist_session_metrics_v1`; a aba Interesse usa
`get_therapist_interest_metrics_v1` e é exclusiva do Premium Plus. Ambas
preservam a amostra mínima de 10 e não expõem pacientes. A exportação CSV
autenticada reutiliza os mesmos contratos agregados.

A telemetria pública é idempotente e agregada por dia, mas nasce desativada até
a validação formal de privacidade e retenção. Ocupação permanece indisponível
até existir histórico reproduzível da oferta. Zero, processamento, amostra
insuficiente e falha são estados diferentes; Aura não recebe dados simulados.
Contratos:
`docs/architecture/therapist-metrics-mtr1-mtr3.md` e
`docs/architecture/therapist-metrics-mtr4-mtr5-mtr7.md`.

O Financeiro do terapeuta está implementado em `/terapeuta/financeiro` com
quatro abas: Resumo, Recebimentos, Repasses e Conta de recebimento. A F0/F1 usa
read models privados versionados sobre `session_payments`, `session_refunds`,
`session_disputes`, lotes, transfers e `therapist_connect_accounts`; a F2
adiciona métricas intermediárias no Resumo via
`get_private_therapist_financial_metrics_v1` para Premium e Premium Plus
(`advanced_metrics`). A F3 adiciona dashboard avançado Premium Plus via
`get_private_therapist_advanced_financial_dashboard_v1`, separando realizado,
contratado e estimado sem afetar ledger ou repasses. Não há aba dedicada de
histórico, dados fictícios ou formulário bancário próprio. Operação financeira
essencial é acessível para Free, Premium e Premium Plus; `advanced_financials`
libera projeções, potencial, retenção avançada, evolução, ranking por terapia e
insights determinísticos. Benchmark não é exibido na experiência financeira do
terapeuta.
Documentação:
`docs/payments/therapist-finance-f0-f1.md` e
`docs/architecture/adr/ADR-012-therapist-finance-f0-f1.md`,
`docs/architecture/adr/ADR-013-therapist-finance-f2-metrics.md`,
`docs/architecture/adr/ADR-014-therapist-finance-f3-advanced-dashboard.md`.

A administração do catálogo canônico de terapias está implementada em
`/admin/terapias`. O shell administrativo usa sessão admin separada, RLS
explícita e a Edge Function `admin-therapy-catalog-command`; o app Next atua
apenas como adaptador fino e revalida as tags públicas afetadas. Publicação,
despublicação, descontinuação, arquivamento, redirects de slug, solicitações de
nova terapia e auditoria ficam documentados em
`docs/architecture/admin-therapy-catalog-phase3.md`.

O mapa operacional de integração entre rotas, páginas, skills, views públicas e domínios fica em `docs/product/integration-map.md`. Consulte esse arquivo antes de criar nova página pública, função ou view compartilhada.

Fallback público não deve mascarar falhas de produção. Dados demonstrativos
públicos só podem ser ativados por flag server-side explícita
`TES_ENABLE_DEMO_DATA=true` fora de produção; zero resultados e 404 não ativam
demo.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Variáveis copiadas de `.env.example`
- Docker ativo para rodar Supabase local
- Supabase CLI para backend local
- Git: em cada máquina, prefira `git` disponível no PATH. Neste computador Windows específico, o fallback encontrado foi `C:\Program Files\Git\cmd\git.exe`; em outras máquinas, especialmente macOS/Linux ou outro Windows, o caminho pode ser diferente e deve ser descoberto localmente antes de documentar ou automatizar.

## Instalação

1. Instale dependências:
   ```bash
   npm install
   ```
2. Configure ambiente:
   ```bash
   cp .env.example .env.local
   ```
3. Rode o projeto:
   ```bash
   npm run dev
   ```

## Comandos

- `npm run dev`: ambiente local.
- `npm run build`: build de produção.
- `npm run start`: serve o build.
- `npm run lint`: lint do Next.js.
- `npm run lint:online-only`: valida a política de produto que impede opções de
  formato não-online fora da allowlist documentada.
- `npm run typecheck`: valida TypeScript.
- `npm run dev:functions`: sobe Supabase Edge Functions locais usando secrets de `supabase/functions/.env.local`, `supabase/functions/.env` ou `.env.local`, nesta ordem. As chaves locais do Supabase sao injetadas em memoria pela CLI e nao devem ser salvas na raiz do app.
- `npm run test:auth:flows`: valida fluxo auth completo via Edge Functions, incluindo senha normal, `MASTER_PASSWORD`, confirmacao normal/automatica, reset e redirecionamentos.
- `npm run test:auth:ui`: smoke visual headed com Playwright/Edge para cadastro de terapeuta e cliente. Use quando o Browser MCP nao estiver disponivel na sessao; se `agent.browsers.list()` retornar vazio, a limitacao e do backend MCP da sessao, nao de dependencia npm do projeto.
- `npm run format`: aplica Prettier.

## Supabase Local

A estrutura local fica em `supabase/`:

- `supabase/config.toml`: configuração local da CLI.
- `supabase/migrations/`: migrations do banco.
- `supabase/seeds/catalog.sql`: catálogo institucional de terapias e Match, seguro para aplicação manual em homologação.
- `supabase/seeds/local-test-data.sql`: fixtures locais de usuários, perfis, serviços, agenda, pagamentos e demais dados de desenvolvimento.
- `supabase/seed.sql`: nota de compatibilidade; a CLI carrega os seeds por `[db.seed].sql_paths`.
- `supabase/functions/match-therapies`: primeira Edge Function determinística.

Com Docker ativo:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint
npx supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts
```

No Windows, execute comandos da Supabase CLI de forma sequencial. Se a CLI
falhar ao gravar `C:\Users\<usuario>\.supabase\telemetry.json`, rode o comando
com telemetria desativada no processo atual:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'
npx supabase db lint --local
```

O Logflare/Vector local permanece desativado em `supabase/config.toml` porque
nao participa das migrations e pode reiniciar quando o Docker Desktop nao expoe
os logs de containers para o coletor. Para mudar `supabase/config.toml`, reinicie
a stack com `npx supabase stop` e `npx supabase start`.

A Edge Function `match-therapies` calcula recomendações por regras e pesos. Ela não usa OpenAI, IA generativa, Stripe ou Zoom.

### Pagamentos, assinaturas e repasses

A arquitetura de pagamentos fica documentada em `docs/payments/architecture.md`.
O contrato da área financeira do terapeuta fica em
`docs/payments/therapist-finance-f0-f1.md`.
O setup operacional dos secrets Stripe fica em `docs/payments/stripe-secrets-setup.md`.
O uso e rotacao do token interno ficam em `docs/payments/internal-operations-token.md`.

Functions principais, atualmente em hardening antes de uso financeiro em
produção:

- Billing: `stripe-sync-billing-catalog`, `stripe-create-subscription-checkout`, `stripe-change-therapist-subscription`, `stripe-cancel-therapist-subscription`, `stripe-create-billing-portal`, `stripe-billing-webhook`.
- Connect: `stripe-connect-create-account`, `stripe-connect-create-account-link`, `stripe-connect-create-login-link`, `stripe-connect-sync-account`, `stripe-connect-webhook`.
- Sessoes e repasses: `session-booking-checkout`, `stripe-create-session-payment`, `request-session-cancellation`, `confirm-session-by-therapist`, `auto-confirm-sessions`, `evaluate-transfer-eligibility`, `create-weekly-payout-batch`, `process-payout-batch`, `retry-failed-payout-items`, `reconcile-stripe-transfers`.

### Zoom

A integracao Zoom usa exclusivamente Zoom Video SDK. Pagamento continua sendo
confirmado pelo Stripe; quando `session_payments.financial_status = paid`, o
backend cria uma `video_sessions` local idempotente para a booking, sem chamada
ao Zoom nessa etapa.

Functions:

- `zoom-video-session-access`: valida usuario, booking, pagamento, status,
  janela de acesso, host-first e gera JWT curto do Video SDK.
- `zoom-webhook`: valida assinatura/challenge e processa eventos operacionais
  `session.*`.
- `zoom-video-session-maintenance`: processa jobs duraveis de encerramento por
  hard timeout, ausencia do terapeuta e reconciliacao operacional.

Scripts:

- `npm run zoom:video-sdk:env`: audita variaveis sem imprimir valores.
- `npm run zoom:video-sdk:test`: roda testes Deno e Vitest da integracao.
- `npm run zoom:video-sdk:webhook:smoke`: envia payloads locais assinados.
- `npm run zoom:video-sdk:webhook:tunnel`: abre tunel ngrok local para validar
  webhook real, sem alterar o Zoom Marketplace, e grava metadados nao secretos
  em `.tmp/zoom-real-homologation.json`.
- `npm run zoom:video-sdk:webhook:real-preflight`: valida gates locais do
  webhook real.
- `npm run zoom:video-sdk:webhook:real-verify -- https://<subdominio-ngrok>/functions/v1/zoom-webhook`:
  verifica a URL publica temporaria e registra confirmacao curta no estado
  temporario.
- `npm run zoom:video-sdk:api:mock`: exercita contrato mockado da API.
- `npm run zoom:video-sdk:real-preflight`: valida ambiente development e
  `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES`, e consulta a API Video SDK somente
  quando `ALLOW_REAL_ZOOM=true`.
- `npm run zoom:video-sdk:test:real`: recusa execucao sem
  `ALLOW_REAL_ZOOM=true`, webhook validado e Supabase local/staging autorizado;
  exige tambem
  `--confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=<ms>`,
  e fica bloqueado por padrao quando usado como homologacao principal porque o
  fluxo completo deve comprovar pagamento Stripe test por Checkout + webhook
  antes de abrir Zoom. A variante
  `--allow-direct-paid-fixture-for-zoom-only` existe somente para diagnostico
  tecnico isolado do Video SDK e nao substitui homologacao transacional.
- `npm run zoom:video-sdk:emergency-end`: encerra a sessao real capturada no
  estado temporario pela REST API oficial e nao imprime o ID completo.
- `npm run homologation:zoom:local`: orquestra os gates locais de Supabase,
  Edge Functions, Stripe CLI, Next, testes locais e Zoom real. O comando injeta
  o signing secret temporario do Stripe CLI apenas no processo local das Edge
  Functions, sanitiza logs em `.tmp/homologation/<runId>/` e para antes da
  sessao real quando a evidencia canonica de pagamento por webhook ainda nao
  estiver registrada.

Documentacao detalhada: `docs/zoom/`.

Secrets Stripe pertencem somente a `supabase/functions/.env.local` ou secrets remotos equivalentes. O app Next.js continua usando apenas chave publicavel. A chave de API server-side canonica e `STRIPE_SECRET_KEY`; nao usar `STRIPE_RESTRICTED_API_KEY` nem `STRIPE_ENVIRONMENT`. Webhooks usam `STRIPE_PLATFORM_WEBHOOK_SECRET`/`STRIPE_CONNECT_WEBHOOK_SECRET` com fallback local para `STRIPE_WEBHOOK_SECRET`. Rotinas privadas usam `PAYMENTS_INTERNAL_OPERATIONS_TOKEN`.

### E-mails transacionais

O modulo de e-mails transacionais roda somente em Supabase Edge Functions. O app Next.js chama APIs server-side locais, que invocam as functions; o navegador nunca chama a Hostinger e nunca recebe `EMAIL_SERVER_API_KEY`.

Functions iniciais:

- `client-auth-signup` e `therapist-auth-signup`: criam usuarios sem e-mail confirmado, geram token hashado de confirmacao e token opaco de polling, e enviam `email_verification`.
- `verify-email`: confirma o e-mail com token de uso unico.
- `check-email-verification-status`: consulta status por token opaco de polling, sem e-mail no payload e sem PII na resposta.
- `resend-email-verification`: reenvia confirmacao com resposta publica generica e cooldown de 60s.
- `request-password-reset`: solicita reset com resposta publica generica.
- `reset-password-with-token`: valida token e troca senha via Auth Admin.
- `sync-email-senders`: sincroniza caixas da Hostinger para administradores.

Secrets das Edge Functions:

- `EMAIL_SERVER_API_KEY`
- `EMAIL_PUBLIC_SITE_URL` ou dominio publico equivalente; quando vier sem protocolo, o runtime normaliza para `https://`, exceto `localhost`/`127.0.0.1`, que usam `http://`.
- `EMAIL_RATE_LIMIT_SALT`
- `CONFIRMED_AUTOMATICALLY_EMAIL`: aceita somente `true` ou `false`; ausente/vazio equivale a `false`. Quando `true`, as functions de cadastro confirmam o Auth via Admin API, nao geram token/e-mail e redirecionam ao login com `verified=1&automatic=1`.
- `MASTER_PASSWORD`: senha master opcional para testes locais. Quando preenchida no runtime das Edge Functions, os logins `client-auth-login` e `therapist-auth-login` aceitam essa senha para gerar uma sessao do usuario informado sem expor o segredo ao app Next.js. A validacao de perfil e e-mail confirmado continua obrigatoria. Nunca configurar em producao.
- `ADMIN_MASTER_PASSWORD_BYPASS_ENABLED`: aceita somente `true` ou `false`; ausente/vazio equivale a `false`. O login `admin-auth-login` so aceita `MASTER_PASSWORD` quando esta flag esta `true` e `SUPABASE_URL` aponta para `localhost` ou `127.0.0.1`; em ambientes remotos o bypass administrativo permanece desativado.

Contrato Hostinger confirmado em documentacao oficial/SDK da Hostinger: `GET https://api.mail.hostinger.com/api/v1/me` retorna as mailboxes gerenciaveis; o envio usa `POST https://api.mail.hostinger.com/api/v1/mailboxes/{mailboxResourceId}/send`, bearer token, `Content-Type: application/json`, payload com `to: string[]`, `display_name`, `subject`, `text` e `html`, e sucesso `204` sem corpo.

Teste real de entrega: `npm run test:email:real` carrega `.env.local` e secrets locais das Edge Functions, usa a service role local em memoria via Supabase CLI, sincroniza mailboxes Hostinger no banco local e so envia quando `ALLOW_REAL_EMAIL_TESTS=true`, `EMAIL_E2E_RECIPIENT`, API key e sender ativo/default estiverem configurados.

Scripts de pagamento:

- `npm run payments:env`: audita variaveis de pagamentos por operacao sem imprimir secrets.
- `npm run payments:env -- catalog`: valida o minimo para sincronizar catalogo.
- `npm run payments:catalog:sync`: sincroniza Stripe Billing pelo `STRIPE_SECRET_KEY` e grava Product/Price IDs no Supabase.
- `npm run payments:catalog:verify`: compara catalogo local com Stripe real.
- `npm run payments:webhooks:listen`: inicia forwarding local dos eventos Stripe
  da plataforma para `stripe-billing-webhook` e de `account.updated` das contas
  conectadas para `stripe-connect-webhook`. A lista completa para configurar no
  Dashboard fica em `docs/payments/stripe-secrets-setup.md`.

`EMAIL_RATE_LIMIT_SALT` deve ser unico por ambiente, secreto e gerado com pelo menos 32 bytes aleatorios. Exemplo PowerShell para gerar um valor novo:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

## Supabase

O `.env.example` da raiz documenta apenas variáveis publicáveis do app Next.js. No front-end, toda variável exposta deve usar prefixo `NEXT_PUBLIC_`.

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave pública recomendada pela Supabase para runtime de browser/server do app Next.js.
- `NEXT_PUBLIC_SITE_URL`: URL pública do site usada por metadata/sitemap; se ausente em desenvolvimento, o sitemap usa `http://localhost:3000`.

Não adicionar `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `SERVICE_ROLE_KEY`, `DATABASE_URL` ou qualquer secret não público no `.env.local`, `.env.production` ou `.env.example` da raiz. Secrets Supabase pertencem ao escopo das Edge Functions; os exemplos ficam em `supabase/functions/.env.example`. No Supabase local, a CLI injeta as variáveis do projeto automaticamente ao iniciar o ambiente e executar functions.

Auditoria e regra operacional: `docs/security/supabase-env-audit.md`.

Não commitar `.env`, `.env.local` ou segredos reais.

## MVP Inicial

O recorte funcional inicial está documentado em `docs/product/mvp.md`: MVP transacional com descoberta, match determinístico, reserva preparada, planos de terapeuta e base Supabase local.
