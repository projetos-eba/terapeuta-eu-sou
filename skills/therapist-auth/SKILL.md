# Therapist Auth

Use esta skill ao implementar, auditar ou refatorar o fluxo inicial de autenticação de terapeutas e a base compartilhada de login usada por cliente, terapeuta e admin.

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/product/sitemap.md`.
3. `docs/product/routes-map.md`.
4. `docs/product/page-inventory.md`.
5. `docs/design-system/design-system.md`.
6. `src/lib/routes.ts`.
7. `src/domain/tes/plan-definitions.ts`.
8. `src/domain/tes/permissions.ts`.
9. `src/features/therapist-auth/`.

## Rotas

- Cadastro canônico: `/terapeuta/cadastro`.
- Login canônico: `/terapeuta/login`.
- Confirmacao de e-mail: `/confirmar-email`.
- Recuperacao de senha: `/reset-senha`.
- Checkout canônico: `/terapeuta/checkout?plan=premium|premium_plus`.
- Alias público de perfil: `/terapeuta/:slug` continua redirecionando para `/terapeutas/:slug`; rotas estáticas de auth têm precedência no App Router.
- Área pós-login: todo terapeuta ativo segue para `/terapeuta`.
- Plano e capability resolvem a experiência depois da autenticação.
- `/basico`, `/pro` e `/plus` são aliases temporários, nunca fonte de
  autorização.

## Regras de plano

- Usar somente os enums técnicos `free`, `premium` e `premium_plus`.
- O catálogo em `src/domain/tes/plan-definitions.ts` é a fonte para CTAs de plano.
- O frontend envia apenas o código do plano; preço, Stripe Price ID e ativação de assinatura não vêm do navegador.
- Price IDs de assinatura vêm de `billing_plan_prices`, sincronizado por `npm run payments:catalog:sync` com `STRIPE_SECRET_KEY`.
- Toda conta nova nasce com plano ativo `free`.
- `premium` e `premium_plus` ficam como plano solicitado até o webhook Stripe confirmar a assinatura.

## Cadastro

- `/terapeuta/cadastro` sem `plan` mostra a etapa previa de escolha entre Free,
  Premium e Premium Plus, usando `src/domain/tes/plan-definitions.ts`.
- A etapa previa de escolha de plano usa layout limpo, sem a coluna contextual
  roxa do shell de autenticação.
- O formulário de dados pessoais aparece somente após seleção explícita do
  plano em `/terapeuta/cadastro?plan=free|premium|premium_plus`.

Campos obrigatórios:

- nome completo;
- e-mail;
- celular;
- data de nascimento;
- senha;
- confirmação de senha;
- aceite de termos e privacidade;
- plano pretendido por query param validado.

Validações:

- e-mail válido;
- celular plausível com DDD;
- maior de 18 anos;
- senha mínima de 8 caracteres;
- confirmação igual;
- aceite obrigatório;
- plano limitado a `free`, `premium`, `premium_plus`.

Backend:

- `POST /api/auth/therapist/signup`.
- Tambem usa `POST /api/auth/email/verify`, `POST /api/auth/email/status`, `POST /api/auth/email/resend`, `POST /api/auth/password/request-reset` e `POST /api/auth/password/reset`.
- Usa Supabase Auth/Admin REST somente em Supabase Edge Function.
- O app Next usa apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- A Edge Function deve preferir `SUPABASE_SECRET_KEYS`; o fallback a `SUPABASE_SERVICE_ROLE_KEY` fica restrito ao runtime local/legado das functions.
- Cria `auth.users` sem e-mail confirmado, `profiles.role = therapist` e `therapist_profiles.status = draft`.
- Fluxo normal (`CONFIRMED_AUTOMATICALLY_EMAIL` ausente/vazio/`false`): gera token hashado em `auth_action_tokens`, gera token opaco de polling em `email_verification_status_tokens`, envia `email_verification` pelo modulo `skills/email-delivery` e redireciona para `/confirmar-email?statusToken=*`.
- Fluxo bypass (`CONFIRMED_AUTOMATICALLY_EMAIL=true`): nao gera token nem envia e-mail; confirma Auth via Admin API, revoga tokens antigos, audita como `skipped` e redireciona para `/terapeuta/login?verified=1&automatic=1`.
- A tela `/confirmar-email?token=*` deve disparar a verificacao em modo single-flight por token, abortar tentativa cancelada pelo React Strict Mode e repetir somente falhas transientes de rede/5xx. Token invalido/expirado continua erro imediato.
- Login deve mapear `email_not_confirmed` do Supabase Auth para a mensagem segura de e-mail pendente, nunca para "E-mail ou senha invalidos".
- Reset de senha com token valido enviado por e-mail tambem confirma `auth.users.email_confirmed_at` e `profiles.email_confirmed_at`, pois a posse do e-mail foi comprovada pelo link consumido.
- Perfil inicial deve ficar `is_public = false` e `is_accepting_bookings = false`.
- Em falha depois da criação do usuário Auth, tentar limpeza best-effort e retornar erro genérico.
- Free redireciona para `/terapeuta/login?created=1`.
- Premium e Premium Plus criam uma sessão autenticada e redirecionam para `/terapeuta/checkout`; se a sessão automática falhar, seguem ao login com continuação interna validada.

## Login

- `POST /api/auth/therapist/login`.
- O app Next chama Edge Function; a senha nunca deve ser validada com service role no runtime Next.
- Login de cliente usa `client-auth-login`; login de terapeuta usa `therapist-auth-login`; login admin futuro deve usar `admin-auth-login`.
- Usa password grant REST para senha cadastrada.
- Quando `MASTER_PASSWORD` estiver configurada no runtime das Edge Functions, aceita a senha master somente depois de falha do password grant normal.
- `MASTER_PASSWORD` e service role pertencem somente as Edge Functions; nunca expor ao app Next ou ao navegador.
- A senha master nao pode liberar e-mail nao confirmado nem role diferente da function chamada.
- Verifica `profiles.role = therapist`.
- Define cookies HTTP-only internos para sessão inicial.
- `POST /api/auth/session/refresh` renova a sessão de paciente, terapeuta ou
  admin pelo refresh token HTTP-only do respectivo papel. Ele só roda nos
  últimos 15 minutos do access token, revalida `profiles.role`, rotaciona os
  dois cookies e rejeita origem cruzada.
- A renovação preserva access token curto e mantém a sessão em janela móvel de
  30 dias; não cria nem configura um logout por inatividade.
- Nao define cookies quando o e-mail nao estiver confirmado.
- Redireciona por plano.
- Paciente/admin devem receber a mensagem segura: `Use o acesso correspondente ao seu perfil.`
- O parâmetro de continuação aceita somente `/terapeuta/checkout` com plano pago válido, evitando open redirect.

## Checkout

- Exige sessão válida de terapeuta.
- Aceita apenas `premium` ou `premium_plus`.
- Mostra plano solicitado, plano ativo e estado do pagamento.
- Nunca altera `therapist_profiles.plan` no frontend ou em Route Handler do Next.
- O CTA de pagamento chama `stripe-create-subscription-checkout`.
- O acesso Free permanece disponivel enquanto o webhook nao confirma a assinatura.
- A ativacao ocorre somente por `stripe-billing-webhook`, nunca por query string de retorno.

## UI e copy

- Layout simples e centralizado.
- Usar `PublicLogo`, fundo lavanda claro, card central, painel visual decorativo e formulário acessível.
- No mobile, o formulário deve aparecer antes do painel visual decorativo.
- Labels reais, mensagens de erro por campo, foco visível e CTAs com mínimo de 44px.
- Os logins de terapeuta, cliente e admin compartilham controle acessível de
  mostrar/ocultar senha: ícone de olho, rótulo de ação, `aria-pressed` e alvo
  mínimo de 44px, sem mudar o payload ou a validação de autenticação.
- O painel visual usa `brand-primary` (`#6C3D91`) e não o azul profundo.
- Não usar linguagem interna de desenvolvimento na UI, como “hardening” ou “onboarding”, quando houver alternativa clara para a pessoa usuária.
- Nunca prometer renda, aprovação automática, cura, diagnóstico ou resultado garantido.

## Pendências conhecidas

- Captcha e antifraude.
- Proteção real do layout `/terapeuta/*`, com redirects de compatibilidade
  para `/basico/*`, `/pro/*` e `/plus/*`.
- Upload e revisão de documentos.
- Conta bancária para repasse.
- Integracao visual completa de status de assinatura, Connect e repasses nas areas logadas.
- Testes E2E Stripe CLI com eventos reais da conta configurada em `STRIPE_SECRET_KEY`.
- Auditoria LGPD dos consentimentos.

## QA

- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run test:auth:flows` para validar cadastro, login normal, `MASTER_PASSWORD`, confirmacao normal, confirmacao automatica, reset de senha e redirecionamentos por perfil.
- `npm run test:auth:ui` para smoke headed com Playwright/Edge cobrindo cliques reais em `/terapeuta/cadastro` e `/cliente/cadastro`.
- O Browser MCP deve ser tentado primeiro quando estiver disponivel na sessao. Se `agent.browsers.list()` retornar vazio, a indisponibilidade e do backend MCP da sessao, nao de dependencia npm do projeto; use o Playwright local headed como fallback reproduzivel.
- Scripts locais de Edge Functions resolvem secrets nesta ordem: `supabase/functions/.env.local`, `supabase/functions/.env`, `.env.local`.
- Validar `/terapeuta/cadastro?plan=free`, `?plan=premium` e `?plan=premium_plus`.
- Validar `/confirmar-email?statusToken=*` apos cadastro normal.
- Validar `/terapeuta/login?verified=1&automatic=1` apenas com bypass explicitamente ativo.
- Validar `/terapeuta/login?created=1`.
- Validar `/terapeuta/checkout?plan=premium` e `?plan=premium_plus`.
- Confirmar que plano pago solicitado permanece `free` antes do webhook.
- Validar formulário sem env Supabase: telas renderizam e submit retorna erro controlado.
- Com Supabase local, validar criação de `auth.users`, `profiles` e `therapist_profiles`.
- Validar menor de 18 anos, senha divergente, e-mail duplicado e login de perfil não terapeuta.
- Validar senha normal e `MASTER_PASSWORD` para cliente, terapeuta e `admin-auth-login`.
- Validar que `MASTER_PASSWORD` nao autentica e-mail pendente nem role incorreta.
- Validar a rotação de sessão dos três papéis, inclusive role divergente,
  refresh token ausente, origem cruzada e atualização atômica dos cookies.
- Validar reset de senha: solicitacao generica, token de uso unico, senha nova e redirect por role.
- Validar que login com e-mail nao confirmado mostra mensagem de confirmacao pendente para cliente e terapeuta.
- Validar que reset de senha confirma e-mail no Auth e no profile antes de redirecionar para login.
- Em validacao visual com navegador, cobrir cliques reais em login normal/master, cadastro normal com envio de e-mail, confirmacao por link, polling/status, reset valido/invalido, role mismatch e cadastro com confirmacao automatica.

## Assets da plataforma

- O painel visual de login e cadastro usa `therapistLoginIcon` como mídia
  decorativa ampliada, sem fade e sem copy ou checklist. Consulte
  `docs/design-system/platform-assets.md`.
