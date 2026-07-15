# Therapist Auth

Use esta skill ao implementar, auditar ou refatorar o fluxo inicial de autenticação de terapeutas.

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
- Alias público de perfil: `/terapeuta/:slug` continua redirecionando para `/terapeutas/:slug`; rotas estáticas de auth têm precedência no App Router.
- Áreas pós-login:
  - `free` -> `/basico`.
  - `premium` -> `/pro`.
  - `premium_plus` -> `/plus`.

## Regras de plano

- Usar somente os enums técnicos `free`, `premium` e `premium_plus`.
- O catálogo em `src/domain/tes/plan-definitions.ts` é a fonte para CTAs de plano.
- O frontend envia apenas o código do plano; preço, Stripe Price ID e ativação de assinatura não vêm do navegador.

## Cadastro

Campos obrigatórios:

- nome completo;
- e-mail;
- celular;
- data de nascimento;
- senha;
- confirmação de senha;
- aceite de termos e privacidade;
- plano pretendido por query param opcional, com fallback `free`.

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
- Usa Supabase Auth/Admin REST somente no servidor.
- Requer `SUPABASE_SERVICE_ROLE_KEY`.
- Cria `auth.users`, `profiles.role = therapist` e `therapist_profiles.status = draft`.
- Perfil inicial deve ficar `is_public = false` e `is_accepting_bookings = false`.
- Em falha depois da criação do usuário Auth, tentar limpeza best-effort e retornar erro genérico.

## Login

- `POST /api/auth/therapist/login`.
- Usa password grant REST.
- Verifica `profiles.role = therapist`.
- Define cookies HTTP-only internos para sessão inicial.
- Redireciona por plano.
- Paciente/admin devem receber a mensagem segura: `Use o acesso correspondente ao seu perfil.`

## UI e copy

- Layout simples e centralizado.
- Usar `PublicLogo`, fundo lavanda claro, card central, coluna contextual e formulário acessível.
- No mobile, o formulário deve aparecer antes do container explicativo/checklist.
- Labels reais, mensagens de erro por campo, foco visível e CTAs com mínimo de 44px.
- Explicar que perfil público, documentos e conta bancária são recomendados depois, sem bloquear o primeiro acesso.
- Nunca prometer renda, aprovação automática, cura, diagnóstico ou resultado garantido.

## Pendências conhecidas

- Confirmação de e-mail/SMTP.
- Recuperação de senha real.
- Rate limit, captcha e antifraude.
- Proteção real dos layouts `/basico`, `/pro` e `/plus`.
- Upload e revisão de documentos.
- Conta bancária para repasse.
- Stripe Billing para planos pagos.
- Stripe Connect para repasses de sessões.
- Customer Portal.
- Auditoria LGPD dos consentimentos.

## QA

- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- Validar `/terapeuta/cadastro?plan=free`, `?plan=premium` e `?plan=premium_plus`.
- Validar `/terapeuta/login?created=1`.
- Validar formulário sem env Supabase: telas renderizam e submit retorna erro controlado.
- Com Supabase local, validar criação de `auth.users`, `profiles` e `therapist_profiles`.
- Validar menor de 18 anos, senha divergente, e-mail duplicado e login de perfil não terapeuta.
