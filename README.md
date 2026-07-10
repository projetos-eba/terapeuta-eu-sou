# Terapeuta Eu Sou

Projeto web em Next.js 14, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES em CSS Variables.

O backend planejado será Supabase: banco Postgres, autenticação, storage e Supabase Edge Functions para regras de backend. A base local do domínio transacional já começa em `supabase/`, mas o frontend ainda não usa SDK Supabase.

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
