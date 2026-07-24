# Terapeuta Eu Sou

Projeto web em Next.js 14, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES em CSS Variables.

O backend planejado será Supabase: banco Postgres, autenticação, storage e Supabase Edge Functions para regras de backend. A base local do domínio transacional já começa em `supabase/`, mas o frontend ainda não usa SDK Supabase.

A home pública (`/`) consulta views públicas Supabase via REST quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estão configuradas. Sem essas variáveis, ou com valores placeholder, a página usa fallback local e continua renderizando sem expor segredos.

A página pública `/para-terapeutas` usa o catálogo único de planos em `src/domain/tes/plan-definitions.ts`. Nesta etapa os `stripePriceId` permanecem `null`; o frontend envia somente o código do plano (`free`, `premium`, `premium_plus`) no cadastro, e Checkout/webhook Stripe ficam como próxima etapa de backend.

O fluxo inicial de terapeuta usa rotas separadas em `/terapeuta/cadastro` e `/terapeuta/login`. O cadastro chama uma Supabase Edge Function para as operações administrativas de Auth/Admin, sem expor service role no app Next.js. Sem a function configurada, as telas renderizam e o submit retorna erro controlado de configuração ausente.

O fluxo inicial de cliente usa rotas separadas em `/cliente/cadastro` e `/cliente/login`. O cadastro também usa Supabase Auth/Admin via REST server-side, cria `profiles.role = patient` e `patient_profiles`; documentos, verificação profissional e dados bancários não fazem parte do cadastro de cliente.

O Match público usa `/sua-jornada` e `/sua-jornada/resultado`. A configuração vem de `matching_themes`, `matching_interests` e da view `public_matching_config`; o cálculo roda em `/api/public/matching/calculate` com pesos versionados em `matching_weights`, usando apenas a versão publicada. O fluxo é anônimo, usa `sessionStorage` para escolhas temporárias e recomenda terapias, não terapeutas.

O catálogo público de terapias usa `/terapias` e `/api/public/therapies`, consultando a view segura `public_therapies_v` por REST Supabase com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A view expõe apenas terapias com `status = published`, visíveis publicamente e vinculadas a categorias ativas, com contagem pública de terapeutas disponíveis. O detalhe `/terapias/:slug` usa `public_therapy_details_v` para conteúdo editorial e `public_therapist_search` para profissionais relacionados. O Match usa `matching_therapy_settings.is_visible_in_matching` como ativação adicional; uma terapia só entra no Match se também estiver publicada.

O mapa operacional de integração entre rotas, páginas, skills, views públicas e domínios fica em `docs/product/integration-map.md`. Consulte esse arquivo antes de criar nova página pública, função ou view compartilhada.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Variáveis copiadas de `.env.example`
- Docker ativo para rodar Supabase local
- Supabase CLI para backend local

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
- `npm run typecheck`: valida TypeScript.
- `npm run format`: aplica Prettier.

## Supabase Local

A estrutura local fica em `supabase/`:

- `supabase/config.toml`: configuração local da CLI.
- `supabase/migrations/`: migrations do banco.
- `supabase/seed.sql`: seed mínimo do catálogo e pesos de match.
- `supabase/functions/match-therapies`: primeira Edge Function determinística.

Com Docker ativo:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint
npx supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts
```

A Edge Function `match-therapies` calcula recomendações por regras e pesos. Ela não usa OpenAI, IA generativa, Stripe ou Zoom.

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

Contrato Hostinger confirmado em documentacao oficial/SDK da Hostinger: `GET https://api.mail.hostinger.com/api/v1/me` retorna as mailboxes gerenciaveis; o envio usa `POST https://api.mail.hostinger.com/api/v1/mailboxes/{mailboxResourceId}/send`, bearer token, `Content-Type: application/json`, payload com `to: string[]`, `display_name`, `subject`, `text` e `html`, e sucesso `204` sem corpo.

Teste real de entrega: `npm run test:email:real` carrega `.env.local` e `supabase/functions/.env.local`, usa a service role local em memoria via Supabase CLI, sincroniza mailboxes Hostinger no banco local e so envia quando `ALLOW_REAL_EMAIL_TESTS=true`, `EMAIL_E2E_RECIPIENT=viniciusferrari.silva@gmail.com`, API key e sender ativo/default estiverem configurados.

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
