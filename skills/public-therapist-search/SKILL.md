---
name: public-therapist-search
description: Use when implementing, refactoring, auditing, or documenting the public therapist search page `/terapeutas`, including Figma node 13273:3587, URL filters, Supabase view `public_therapist_search`, therapist mocks/seeds, cards, pagination, public copy, QA, or route/docs consistency.
---

# Public Therapist Search

## Fontes obrigatórias

Antes de alterar `/terapeutas`, consultar:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:3587`
3. `docs/product/sitemap.md`
4. `docs/design-system/design-system.md`
5. `docs/product/routes-map.md`
6. `docs/product/page-inventory.md`
7. `src/lib/routes.ts`
8. `src/app/terapeutas/page.tsx`
9. `src/features/public-therapist-search/`
10. `supabase/migrations/*public_therapist_search*.sql` e `supabase/seed.sql`

## Contrato da página

- Rota canônica: `routes.public.therapists` (`/terapeutas`).
- Server Component orientado por `searchParams`.
- Query params suportados: `q`, `therapy`, `theme`, `availability`, `price`, `rating`, `sort`, `page`.
- Links dos cards: `routes.public.therapistProfile(slug)`.
- CTA de reserva: `routes.public.reservation`.
- Não criar `/terapeutas/:slug` dentro desta skill; registrar como pendência até a página de perfil ser implementada.

## Dados

- Fonte dinâmica pública: view Supabase `public_therapist_search`.
- Integração: REST fetch com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Não adicionar `@supabase/supabase-js` sem decisão explícita.
- Fallback local obrigatório em `src/features/public-therapist-search/content.ts`.
- Seeds/mocks: manter 5 terapeutas em `supabase/seed.sql`, com `ana-oliveira` como perfil principal mais rico.
- Toda alteração em view/schema/policy exige migration versionada. Todo mock/seed deve ser idempotente.

## Componentes Esperados

- `PublicHeader`
- hero público com copy acolhedora
- formulário de busca e filtros linkáveis por URL
- contagem de resultados e ordenação
- cards de terapeuta com foto, tags, avaliação, preço, próxima disponibilidade e CTAs
- estado sem resultados
- paginação
- `JourneyBanner`
- `PublicFooter`

Usar componentes existentes de `src/components/tes` antes de criar equivalentes.

## Referência Visual Obrigatória

Para o Figma `13273:3587`, preservar:

- Frame desktop base: `1440px` de largura.
- Margem lateral principal desktop: `68px`.
- Hero: imagem recortada à direita com cerca de `765px x 351px`; título IvyPresto `54px`, duas linhas, trecho final em gradiente roxo-ciano.
- Busca: container central de cerca de `1243px`, `30px` de raio, fundo `#f7f4ff`, borda `#e8e2f6`, sombra suave; input `54px` de altura.
- Filtros: segunda linha dentro do mesmo bloco visual, selects `52px` de altura, raio `16px`, texto `16px`; botão `Limpar Filtros` roxo.
- Resultados: título `26px`, subtítulo `15px`, contagem à direita e select de ordenação `220px x 42px`.
- Cards desktop: duas colunas, cada card aproximadamente `632px x 300px`, raio `18px`, foto `178px x 208px`, badges pequenos `9px`, nome `24px`, descrição `11px`, CTAs compactos.
- Banner final: placeholder visual `Fazer banner novo` em bloco `1304px x 178px`, fundo lavanda translúcido.

Não substituir esses padrões por cards editoriais grandes, hero alternativo, copy extra ou componentes genéricos que mudem a hierarquia da tela.

## Copy Responsável

- Usar linguagem acolhedora, clara e sem pressão.
- Não prometer cura, diagnóstico, melhora garantida ou resultado terapêutico.
- Evitar comparação agressiva entre terapeutas.
- Favoritos públicos podem aparecer como affordance visual, mas persistência autenticada deve ficar pendente enquanto não houver backend dedicado.

## Checklist de QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`
- Se Docker/Supabase local permitir: `npx supabase db reset` e conferir a view `public_therapist_search`.
- Validar URLs: `/terapeutas`, `/terapeutas?q=ana`, `/terapeutas?therapy=terapia-integrativa`, `/terapeutas?price=100-150`, `/terapeutas?rating=4-plus`, `/terapeutas?sort=price_asc`, `/terapeutas?page=2`.
- Validar responsividade desktop/mobile contra o Figma `13273:3587`.
- Confirmar que a view não expõe email, telefone, dados internos de paciente, dados sensíveis, `meeting_url` ou campos privados.

## Pendências Conhecidas

- Persistir favoritos apenas para usuário autenticado.
- Conectar reserva real ao serviço/horário escolhido.
- Evoluir disponibilidade para exceções, conflitos, reservas já ocupadas e slots reais.
- Validar migration/seeds em Supabase local quando Docker estiver disponível.
