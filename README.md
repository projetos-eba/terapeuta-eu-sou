# Terapeuta Eu Sou

Projeto web em Next.js 14, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES em CSS Variables.

O backend planejado será Supabase: banco Postgres, autenticação, storage e Supabase Edge Functions para regras de backend. Nesta etapa, o projeto apenas prepara variáveis e documentação; ainda não há integração funcional com Supabase no código.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Variáveis copiadas de `.env.example`
- Supabase CLI para a próxima fase de backend local

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

## Supabase

Variáveis públicas e segredos esperados ficam em `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública anon.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço, somente servidor e Edge Functions.
- `SUPABASE_JWT_SECRET`: segredo JWT do projeto.

Não commitar `.env`, `.env.local` ou segredos reais.

## MVP Inicial

O recorte funcional inicial está documentado em `docs/product/mvp.md`: fluxo público + reserva, com login/cadastro preparados para a fase Supabase.
