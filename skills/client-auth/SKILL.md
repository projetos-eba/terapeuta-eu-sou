# Client Auth

Use esta skill ao implementar, auditar ou refatorar o fluxo inicial de autenticação de clientes.

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/product/sitemap.md`.
3. `docs/product/routes-map.md`.
4. `docs/product/page-inventory.md`.
5. `docs/design-system/design-system.md`.
6. `src/lib/routes.ts`.
7. `src/features/client-auth/`.
8. `supabase/migrations/20260708090000_initial_mvp_domain.sql`.

## Rotas

- Cadastro canônico: `/cliente/cadastro`.
- Login canônico: `/cliente/login`.
- Confirmacao de e-mail: `/confirmar-email`.
- Recuperacao de senha: `/reset-senha`.
- Área pós-login: `/app`.
- APIs:
  - `POST /api/auth/client/signup`.
  - `POST /api/auth/client/login`.
  - `GET /api/auth/client/session`.
  - `DELETE /api/auth/client/session`.
  - `POST /api/auth/session/refresh` com `{ role: "patient" }`.
  - `POST /api/auth/email/verify`.
  - `POST /api/auth/email/status`.
  - `POST /api/auth/email/resend`.
  - `POST /api/auth/password/request-reset`.
  - `POST /api/auth/password/reset`.

## Cadastro

Campos obrigatórios:

- nome;
- e-mail;
- celular;
- data de nascimento;
- senha;
- confirmação de senha;
- aceite de termos e privacidade.

Backend:

- Usa Supabase Auth/Admin REST somente em Supabase Edge Function.
- O app Next usa apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- A Edge Function deve preferir `SUPABASE_SECRET_KEYS`; o fallback a `SUPABASE_SERVICE_ROLE_KEY` fica restrito ao runtime local/legado das functions.
- Cria `auth.users` sem e-mail confirmado, `profiles.role = patient` e `patient_profiles`.
- Fluxo normal (`CONFIRMED_AUTOMATICALLY_EMAIL` ausente/vazio/`false`): gera token hashado em `auth_action_tokens`, gera token opaco de polling em `email_verification_status_tokens`, envia `email_verification` pelo modulo `skills/email-delivery` e redireciona para `/confirmar-email?statusToken=*`.
- Fluxo bypass (`CONFIRMED_AUTOMATICALLY_EMAIL=true`): nao gera token nem envia e-mail; confirma Auth via Admin API, revoga tokens antigos, audita como `skipped` e redireciona para `/cliente/login?verified=1&automatic=1`.
- `patient_profiles.timezone` deve usar `America/Sao_Paulo`.
- `marketing_consent` começa como `false`.
- Em falha depois da criação do usuário Auth, tentar limpeza best-effort e retornar erro genérico.

## Login

- Usa password grant REST.
- Verifica `profiles.role = patient`.
- Define cookies HTTP-only internos `tes_patient_access_token` e `tes_patient_refresh_token`.
- Nao define cookies quando o e-mail nao estiver confirmado.
- Redireciona para `/app`.
- Terapeuta/admin devem receber a mensagem segura: `Esse e-mail não corresponde a esse perfil de login.`
- Guards autenticados leem `profiles`/`patient_profiles` via token do usuário; além das policies RLS, as tabelas precisam de `grant select` para `authenticated`.

## Sessão pública segura

- `GET /api/auth/client/session` lê o cookie HTTP-only e retorna apenas resumo
  seguro do próprio paciente: nome, e-mail, telefone, avatar e timezone.
- Se a sessão não existir, estiver expirada ou não pertencer a `patient`,
  retornar `{ authenticated: false }`.
- `DELETE /api/auth/client/session` faz logout best-effort no Supabase Auth e
  apaga `tes_patient_access_token` e `tes_patient_refresh_token`.
- `POST /api/auth/session/refresh` usa somente o refresh token HTTP-only do
  papel solicitado, renova apenas quando o access token estiver nos últimos 15
  minutos, valida novamente `profiles.role` e grava o novo par de cookies. A
  rotação nunca expõe tokens ao navegador.
- A sessão tem janela móvel de 30 dias porque cada renovação segura estende a
  validade do cookie de refresh; não há logout por inatividade implementado.
- O header público usa essa rota para trocar “Entrar | Cadastre-se” por
  “Olá, [Nome]”, com atalhos para painel, encontros e logout.

Cada login bem-sucedido anuncia um marcador não sensível e estável por conta do
papel cliente. Abas do mesmo navegador que exibem outra conta cliente são
redirecionadas ao login; um novo login da mesma conta mantém as abas.
Navegadores, perfis ou janelas anônimas diferentes mantêm sessões
independentes. APIs de dados autenticados devem receber o papel explicitamente
quando houver mais de um papel disponível no navegador; na ausência de papel,
uma solicitação ambígua deve falhar fechada para evitar mistura de perfis.

## UI e copy

- Usar fundo lavanda suave, card central, `PublicLogo`, formulário com labels reais e CTA com mínimo de 44px.
- O retorno deve compartilhar uma faixa relativa com o logo: no mobile exibir
  somente o ícone em alvo mínimo de 44px, sem sobrepor a marca; a palavra
  “Voltar” permanece visível em telas maiores.
- O campo de senha do login deve oferecer controle acessível para mostrar e
  ocultar a senha, com rótulo de ação, estado `aria-pressed` e alvo mínimo de
  44px; isso não altera o contrato de autenticação.
- Usar imagem versionada em `public/client-auth/client-auth-journey-room.png`.
- Desktop: formulário e imagem em composição lateral.
- Mobile: formulário primeiro, imagem abaixo.
- Não mencionar documentos, conta bancária, repasse ou verificação profissional.
- Não usar linguagem interna de desenvolvimento na UI, como “hardening” ou “onboarding”, quando houver alternativa clara para a pessoa usuária.
- Nunca prometer cura, diagnóstico ou resultado garantido.

## QA adicional desta implementação

- Validar o botão Voltar nas telas de login e cadastro e o isolamento de duas
  abas cliente no mesmo navegador, além da coexistência em contextos de
  navegador diferentes.

## Pendências conhecidas

- Captcha e antifraude.
- Proteção real de `/app`.
- Auditoria LGPD dos consentimentos.

## QA

- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- Validar `/cliente/cadastro`.
- Validar `/confirmar-email?statusToken=*` apos cadastro normal.
- Validar `/cliente/login?verified=1&automatic=1` apenas com bypass explicitamente ativo.
- Validar formulário sem env Supabase: telas renderizam e submit retorna erro controlado.
- Com Supabase local, validar criação de `auth.users`, `profiles` e `patient_profiles`.
- Validar menor de 18 anos, senha divergente, e-mail duplicado e login de perfil não paciente.
- Validar header público autenticado e logout por `/api/auth/client/session`.
- Validar renovação próxima à expiração, role incorreto, cookies rotacionados e
  rejeição de origem cruzada em `/api/auth/session/refresh`.
