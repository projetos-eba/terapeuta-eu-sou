# Email Delivery

Use esta skill ao implementar, auditar ou refatorar e-mails transacionais, confirmacao de e-mail, reenvio de confirmacao e recuperacao de senha.

## Fontes obrigatorias

1. `AGENTS.md`.
2. `docs/product/integration-map.md`.
3. `docs/product/sitemap.md`.
4. `docs/product/routes-map.md`.
5. `docs/product/page-inventory.md`.
6. `docs/design-system/design-system.md`.
7. `src/lib/routes.ts`.
8. `src/lib/supabase/edge-functions.ts`.
9. `supabase/migrations/20260724131000_transactional_email_auth_flows.sql`.
10. `supabase/migrations/20260724133000_email_verification_status_tokens.sql`.
11. `supabase/migrations/20260724134000_add_profiles_email_confirmed_at.sql`.
12. `supabase/migrations/20260814190000_provision_transactional_email_actions.sql`.
13. `supabase/functions/_shared/email/`.
14. `supabase/functions/_shared/auth/`.
15. `supabase/functions/client-auth-signup/`.
16. `supabase/functions/therapist-auth-signup/`.

## Rotas e APIs

- Pagina de confirmacao: `/confirmar-email`.
- Pagina de recuperacao: `/reset-senha`.
- `POST /api/auth/email/verify`.
- `POST /api/auth/email/status`.
- `POST /api/auth/email/resend`.
- `POST /api/auth/password/request-reset`.
- `POST /api/auth/password/reset`.

## Banco

- `email_action_definitions`: catalogo de acoes (`email_verification`, `password_reset`).
- `email_sender_profiles`: caixas sincronizadas da Hostinger, sem credenciais.
- `email_action_settings`: remetente especifico por acao e flag `enabled`.
- `email_delivery_logs`: auditoria sanitizada de sucesso, erro e skipped.
- `auth_action_tokens`: tokens de uso unico; guardar somente hash SHA-256.
- `email_verification_status_tokens`: tokens opacos de polling; guardar somente hash SHA-256, sem e-mail.
- `email_rate_limit_events`: eventos persistentes com identificadores hashados.
- `profiles.email_confirmed_at`: espelho transacional da confirmacao do Supabase Auth para polling e bloqueio server-side; Auth continua sendo fonte autoritativa.

As acoes essenciais de Auth sao provisionadas pela migration, sem sobrescrever
um estado operacional que tenha sido desativado deliberadamente. Remetente e
habilitacao por acao continuam configuracao operacional do ambiente.

## Edge Functions

- `sync-email-senders`: exige usuario autenticado com `profiles.role = admin`.
- `verify-email`: publica controlada; consome token `email_verification`.
- `check-email-verification-status`: publica controlada; consulta apenas por status token opaco, sem PII e com destino calculado no servidor.
- `resend-email-verification`: publica controlada; aceita e-mail ou status token, resposta generica e cooldown de 60s.
- `request-password-reset`: publica controlada; resposta generica.
- `reset-password-with-token`: publica controlada; troca senha via Auth Admin.
- `client-auth-signup` e `therapist-auth-signup`: no fluxo normal criam usuario nao confirmado, criam token de link e token de status, e enviam confirmacao; com `CONFIRMED_AUTOMATICALLY_EMAIL=true`, confirmam via Auth Admin, revogam tokens antigos, auditam bypass e redirecionam ao login sem criar sessao.

## Variaveis

- `EMAIL_SERVER_API_KEY`: somente Edge Functions.
- `EMAIL_PUBLIC_SITE_URL`: base dos links enviados.
- `EMAIL_RATE_LIMIT_SALT`: sal para hash de identificadores de rate limit.
- `EMAIL_OUTBOX_DISPATCH_SECRET`: autentica exclusivamente dispatch interno e
  recovery; também existe no Vault remoto como
  `email_outbox_dispatch_secret`.
- `EMAIL_OUTBOX_TEST_FAILURE_SECRET`: exclusivo de HML, para falha one-shot
  na borda do provider; produção não deve configurá-lo.
- `CONFIRMED_AUTOMATICALLY_EMAIL`: somente Edge Functions; ausente/vazio equivale a `false`; aceita apenas `true` ou `false`; valor invalido deve falhar fechado e nunca ativar bypass.
- `ALLOW_REAL_EMAIL_TESTS`: opt-in local para `npm run test:email:real`.
- `EMAIL_E2E_RECIPIENT`: deve ser exatamente um dos destinatários autorizados para o teste real: `viniciusferrari.silva@gmail.com` ou `ferrarimarketing9@gmail.com`.
- `EMAIL_E2E_ACTION_KEYS`: obrigatório no teste real e deve conter exatamente uma action key.
- `EMAIL_E2E_SENDER_EMAIL`: caixa gerenciada opcional para o harness real; a seleção usa snapshot local e não altera o remetente padrão nem settings por evento.

`EMAIL_PUBLIC_SITE_URL` pode ser informado com protocolo ou apenas dominio. Dominio sem protocolo vira `https://`; `localhost` e `127.0.0.1` viram `http://`.

`EMAIL_RATE_LIMIT_SALT` deve ser secreto, unico por ambiente e ter no minimo 32 bytes aleatorios antes de codificacao.

Nunca adicionar essas variaveis ao `.env.example` da raiz do Next.js.

## Provider

Provider inicial: Hostinger Mail API.

- Base esperada: `https://api.mail.hostinger.com`.
- Listagem confirmada: `GET /api/v1/me`, bearer token, retorna account com `data.mailboxes[]`, `resource_id` e `address`.
- Envio confirmado: `POST /api/v1/mailboxes/{mailboxResourceId}/send`, bearer token, `Content-Type: application/json`, payload HTML com `to: string[]`, `displayName`, `subject` e `html`. Embora a propriedade Python seja `display_name`, o SDK oficial declara `alias="displayName"` e serializa o JSON em camelCase.
- O renderer continua produzindo a versão `text` para preview, testes e compatibilidade futura, mas o adaptador Hostinger não a envia junto do HTML.
- O `.eml` recebido em 2026-08-27 comprovou que a linha visual solta no Gmail era texto remanescente de `<title>`: o sanitizer descartava a tag e preservava o conteúdo dentro de `<head>`. O shell padrão não usa `<title>` e o sanitizer descarta integralmente tag e conteúdo de qualquer `<title>` customizado.
- A listagem `/api/v1/me` pode retornar somente endereço e ID da mailbox. Quando não houver nome explícito, o provider envia `TES - Terapeuta Eu Sou` em `displayName`; um nome fornecido pela Hostinger continua tendo precedência.
- Sucesso de envio: `204` sem corpo.

Fonte consultada: documentacao oficial/SDK Hostinger Mail API em 2026-07-24.

## Defaults e HTML transacional

- O Manual de Comunicação Automatizada TES é fonte editorial; não cria action
  key, trigger, token ou dado de domínio.
- O `emailActionRegistry` mantém os defaults oficiais e o shell HTML compartilhado
  usa tabelas de apresentação, preheader oculto, logo oficial TES por URL HTTPS
  pública, CTA HTTPS descritivo e footer institucional. O logo deve ter `alt`,
  dimensões controladas e nunca usar `data:`. Não usar scripts ou CSS do app.
- O sanitizer de HTML permite somente estrutura e estilos seguros de e-mail
  (tabelas de apresentação, bordas, espaçamento, tipografia e CTA). Qualquer
  expansão deve preservar a remoção de scripts, handlers, `javascript:` e tags
  executáveis.
- Não aumentar `currentTemplateVersion` apenas para alterar o visual: versões
  existentes são usadas pelos snapshots da outbox. Planejar resolução de versão
  compatível antes de qualquer bump.

## Seguranca

- Nunca logar token bruto, senha, nova senha, API key, cookies ou headers completos.
- Tokens expiram em 24 horas para confirmacao e 1 hora para reset.
- Tokens sao revogados ao gerar nova solicitacao da mesma finalidade.
- Token de status e token de link devem ser sempre distintos.
- Polling nunca envia e-mail, nunca retorna e-mail/nome/userId e nunca redireciona para rota externa.
- Login deve bloquear conta sem `email_confirmed_at` e nao definir cookies.
- Reset e reenvio devem usar respostas publicas genericas.
- Tabelas sensiveis devem permanecer com RLS habilitada e sem policy comum para `anon` ou `authenticated`.

## Configuracao manual futura

- Aplicar migrations no Supabase remoto.
- Configurar secrets das Edge Functions.
- Deploy das functions novas e alteradas.
- Rodar `sync-email-senders` com usuario admin.
- Definir um remetente ativo como padrao em `email_sender_profiles`.
- Opcionalmente definir remetente especifico em `email_action_settings`.
- Confirmar SPF, DKIM e DMARC no dominio de envio.
- Rodar `npm run test:email:real` somente com opt-in, destinatário aprovado e exatamente uma `EMAIL_E2E_ACTION_KEYS`. Em Windows/local, o runner captura a service role local em memória, usa fixture fictícia, limita o provider a uma tentativa e mantém um gate persistente de 120 segundos gravado antes do POST. A execução nunca percorre o catálogo, nunca espera para disparar automaticamente e nunca repete rejeição, timeout ou resultado ambíguo.

## QA

- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `deno test --config supabase/functions/deno.json supabase/functions/_shared/auth supabase/functions/_shared/email` quando Deno estiver disponivel.
- `npx supabase db lint`.
- Não executar `supabase db reset` apenas para homologação de e-mail real.

Validar manualmente:

- Cadastro de cliente e terapeuta cria usuario nao confirmado.
- Cadastro normal abre `/confirmar-email?statusToken=*`.
- Polling confirma sem e-mail no payload e redireciona para login, nao para area protegida.
- Bypass ativo redireciona para `/cliente/login?verified=1&automatic=1` ou `/terapeuta/login?verified=1&automatic=1`, sem enviar e-mail.
- Login nao confirmado retorna `Confirme seu e-mail antes de entrar.` e nao cria cookies.
- Confirmacao com token redireciona para login correto.
- Reset nao revela existencia de conta.
- Tokens brutos nao aparecem em logs nem no banco.
