# Public Therapies Catalog Skill

Use esta skill ao criar, revisar ou refatorar a página pública `/terapias`, a API pública de listagem de terapias ou integrações diretas com o catálogo público.

## Fontes Obrigatórias

- `AGENTS.md`
- Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:1439`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/therapies/`
- `supabase/migrations/*public_therapies*`

## Rota E Contrato

- Rota canônica: `/terapias`
- Detalhe: `/terapias/:slug`
- API: `GET /api/public/therapies`
- Query params: `q`, `category`, `sort`, `page`, `pageSize`
- Sorts públicos: `relevance`, `most_searched`, `popular`, `newest`, `az`
- Match deve apontar para `/terapias/:slug?source=match`

## Dados

Fonte central:

- `therapies`
- `therapy_categories`

View pública:

- `public_therapies_v`

A view deve expor somente terapias com `therapies.status = published`, visíveis publicamente e com categoria ativa. O Match usa `matching_therapy_settings.is_visible_in_matching` como ativação adicional; uma terapia só entra no Match se também estiver publicada. Ela pode retornar dados editoriais, categoria, contagem de terapeutas disponíveis, sinalizadores de popularidade e novidade. Não expor pesos do Match, dados internos de admin, terapeutas não aprovados, perfis privados ou serviços inativos.

## Componentes Esperados

- `PublicHeader`
- Hero com imagem `public/therapies/hero-therapies.png`
- Busca ampla por URL
- `TherapyFilters`
- `CategoryFilter`
- `TherapyGrid`
- `TherapyCard`
- CTA para `/sua-jornada`
- `PublicFooter`

## Responsividade

- Desktop: hero com imagem lateral, filtros horizontais, sidebar de categorias e grid de 4 colunas.
- Tablet: grid de 2 colunas, filtros acima da listagem.
- Mobile: hero reduzido, busca primeiro, filtros em accordion, grid em 1 coluna quando a descrição precisar respirar.

## Copy Responsável

- A página educa e orienta; não vende diretamente sessão.
- Não prometer cura, diagnóstico, transformação garantida ou resultado.
- Preferir CTAs como “Conhecer terapia” e “Fazer jornada guiada”.

## QA

- `/terapias`
- `/terapias?q=reiki`
- `/terapias?category=emocional`
- `/terapias?sort=newest&page=2`
- Estado sem Supabase configurado
- Estado sem resultados
- Imagem ausente
- Mobile com filtros recolhidos
- Links para `/terapias/:slug`
- Favoritar anônimo encaminha para login de cliente

Rodar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`

## Pendências Conhecidas

- Persistência real de favoritos de terapias para usuário autenticado.
- Detalhe `/terapias/:slug` consumindo catálogo real e JSON-LD `Service`.
- Sitemap dinâmico apenas com terapias publicadas.
- Métricas reais separadas para “Mais procuradas” e “Mais populares”.
- Drawer/bottom sheet mobile completo caso a lista de categorias cresça muito.
