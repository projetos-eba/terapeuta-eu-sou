# Terapeuta Eu Sou

Projeto web em Next.js 14, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES em CSS Variables.

O backend planejado será Supabase: banco Postgres, autenticação, storage e Supabase Edge Functions para regras de backend. A base local do domínio transacional já começa em `supabase/`, mas o frontend ainda não usa SDK Supabase.

A home pública (`/`) consulta views públicas Supabase via REST quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão configuradas. Sem essas variáveis, ou com valores placeholder, a página usa fallback local e continua renderizando sem expor segredos.

A página pública `/para-terapeutas` usa o catálogo único de planos em `src/domain/tes/plan-definitions.ts`. Nesta etapa os `stripePriceId` permanecem `null`; o frontend envia somente o código do plano (`free`, `premium`, `premium_plus`) no cadastro, e Checkout/webhook Stripe ficam como próxima etapa de backend.

O fluxo inicial de terapeuta usa rotas separadas em `/terapeuta/cadastro` e `/terapeuta/login`. O cadastro chama Supabase Auth/Admin via REST no servidor, sem `@supabase/supabase-js`, cria `profiles.role = therapist` e `therapist_profiles` em `draft`. Para cadastro real, `SUPABASE_SERVICE_ROLE_KEY` precisa existir apenas no ambiente server-side; sem ela, as telas renderizam e o submit retorna erro controlado de configuração ausente.

O fluxo inicial de cliente usa rotas separadas em `/cliente/cadastro` e `/cliente/login`. O cadastro também usa Supabase Auth/Admin via REST server-side, cria `profiles.role = patient` e `patient_profiles`; documentos, verificação profissional e dados bancários não fazem parte do cadastro de cliente.

O Match público usa `/sua-jornada` e `/sua-jornada/resultado`. A configuração vem de `matching_themes`, `matching_interests` e da view `public_matching_config`; o cálculo roda em `/api/public/matching/calculate` com pesos versionados em `matching_weights`, usando apenas a versão publicada. O fluxo é anônimo, usa `sessionStorage` para escolhas temporárias e recomenda terapias, não terapeutas.

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

## Supabase

Variáveis públicas e segredos esperados ficam em `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública anon.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço, somente servidor e Edge Functions.
- `SUPABASE_JWT_SECRET`: segredo JWT do projeto.

Não commitar `.env`, `.env.local` ou segredos reais.

## MVP Inicial

O recorte funcional inicial está documentado em `docs/product/mvp.md`: MVP transacional com descoberta, match determinístico, reserva preparada, planos de terapeuta e base Supabase local.
