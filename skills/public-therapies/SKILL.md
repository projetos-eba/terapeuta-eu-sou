# Public Therapies Catalog Skill

Use esta skill ao criar, revisar ou refatorar a página pública `/terapias`, o detalhe `/terapias/:slug`, a API pública de listagem de terapias ou integrações diretas com o catálogo público.

## Fontes Obrigatórias

- `AGENTS.md`
- Figma `Projeto Terapeuta Eu Sou Atualizado`, nodes `13273:1439` e `13502:687`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/therapies/`
- `supabase/migrations/*public_therapies*`
- `supabase/migrations/*public_therapy_detail*`

## Rota E Contrato

- Rota canônica: `/terapias`
- Detalhe: `/terapias/:slug`
- API: `GET /api/public/therapies`
- Query params: `q`, `category`, `sort`, `page`, `pageSize`
- Sorts públicos: `relevance`, `most_searched`, `popular`, `newest`, `az`
- Match deve apontar para `/terapias/:slug?source=match`
- Detalhe deve usar `routes.public.therapyDetail(slug)` e preservar `source=match` nos links seguintes.

## Dados

Fonte central:

- `therapies`
- `therapy_categories`
- `therapy_public_content`
- `therapy_highlights`
- `therapy_benefits`

View pública:

- `public_therapies_v`
- `public_therapy_details_v`
- `public_therapist_search` para profissionais relacionados por `therapy_slug`

As views devem expor somente terapias com `therapies.status = published`, visíveis publicamente e com categoria ativa. O Match usa `matching_therapy_settings.is_visible_in_matching` como ativação adicional; uma terapia só entra no Match se também estiver publicada. Elas podem retornar dados editoriais, categoria, contagem de terapeutas disponíveis, sinalizadores de popularidade e novidade. Não expor pesos do Match, dados internos de admin, terapeutas não aprovados, perfis privados ou serviços inativos.

Para profissionais relacionados:

- consultar `public_therapist_search?therapy_slug=eq.<slug>&limit=3`;
- avaliações e sessões contam apenas bookings `completed` e `paid`;
- ordenação não pode considerar plano do terapeuta;
- se o perfil for novo, mostrar “Novo”, nunca `0,0`.

## Componentes Esperados

- `PublicHeader`
- Hero com imagem `public/therapies/hero-therapies.png`
- Busca ampla por URL
- `TherapyFilters`
- `CategoryFilter`
- `TherapyGrid`
- `TherapyCard`
- CTA para `/sua-jornada`
- Detalhe: `TherapyHero`, `TherapyOverview`, `TherapyBenefits`, `RelatedTherapists`, `RelatedTherapistCard`, `TherapyClosingCta`
- `PublicFooter`

## Responsividade

- Desktop: hero com imagem lateral, filtros horizontais, sidebar de categorias e grid de 4 colunas.
- Tablet: grid de 2 colunas, filtros acima da listagem.
- Mobile: hero reduzido, busca primeiro, filtros em accordion, grid em 1 coluna quando a descrição precisar respirar.
- Detalhe mobile: título/categoria, descrição, imagem, destaques, CTA, overview, benefícios e profissionais em cards verticais.

## Copy Responsável

- A página educa e orienta; não vende diretamente sessão.
- O detalhe educa sobre a abordagem e conduz a profissionais relacionados, sem compatibilidade terapeuta-paciente inventada.
- Não prometer cura, diagnóstico, transformação garantida ou resultado.
- Preferir CTAs como “Conhecer terapia” e “Fazer jornada guiada”.

## QA

- `/terapias`
- `/terapias?q=reiki`
- `/terapias?category=emocional`
- `/terapias?sort=newest&page=2`
- `/terapias/reiki`
- `/terapias/reiki?source=match`
- slug inexistente em `/terapias/:slug`
- Estado sem Supabase configurado
- Estado sem resultados
- Imagem ausente
- Mobile com filtros recolhidos
- Links para `/terapias/:slug`
- Links de detalhe para `/terapeutas?therapy=:slug&source=*`
- Links de card para `/terapeutas/:slug?therapy=:slug&source=*`
- Favoritar anônimo encaminha para login de cliente

Rodar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`

## Pendências Conhecidas

- Persistência real de favoritos de terapias para usuário autenticado.
- Métricas reais separadas para “Mais procuradas” e “Mais populares”.
- Drawer/bottom sheet mobile completo caso a lista de categorias cresça muito.
- Auditar `/admin/terapias` para editar `therapy_public_content`, highlights e benefícios sem alterar pesos do Match.
