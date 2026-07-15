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
- Área pós-login: `/app`.
- APIs:
  - `POST /api/auth/client/signup`.
  - `POST /api/auth/client/login`.

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

- Usa Supabase Auth/Admin REST somente no servidor.
- Requer `SUPABASE_SERVICE_ROLE_KEY`.
- Cria `auth.users`, `profiles.role = patient` e `patient_profiles`.
- `patient_profiles.timezone` deve usar `America/Sao_Paulo`.
- `marketing_consent` começa como `false`.
- Em falha depois da criação do usuário Auth, tentar limpeza best-effort e retornar erro genérico.

## Login

- Usa password grant REST.
- Verifica `profiles.role = patient`.
- Define cookies HTTP-only internos `tes_patient_access_token` e `tes_patient_refresh_token`.
- Redireciona para `/app`.
- Terapeuta/admin devem receber a mensagem segura: `Use o acesso correspondente ao seu perfil.`

## UI e copy

- Usar fundo lavanda suave, card central, `PublicLogo`, formulário com labels reais e CTA com mínimo de 44px.
- Usar imagem versionada em `public/client-auth/client-auth-journey-room.png`.
- Desktop: formulário e imagem em composição lateral.
- Mobile: formulário primeiro, imagem abaixo.
- Não mencionar documentos, conta bancária, repasse ou verificação profissional.
- Nunca prometer cura, diagnóstico ou resultado garantido.

## Pendências conhecidas

- Confirmação de e-mail/SMTP.
- Recuperação de senha real.
- Rate limit, captcha e antifraude.
- Proteção real de `/app`.
- Auditoria LGPD dos consentimentos.

## QA

- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- Validar `/cliente/cadastro`.
- Validar `/cliente/login?created=1`.
- Validar formulário sem env Supabase: telas renderizam e submit retorna erro controlado.
- Com Supabase local, validar criação de `auth.users`, `profiles` e `patient_profiles`.
- Validar menor de 18 anos, senha divergente, e-mail duplicado e login de perfil não paciente.
