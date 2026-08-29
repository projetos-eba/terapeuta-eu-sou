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
- `public_matching_therapies_v` para candidatos elegíveis no Match
- `get_public_therapy_therapists_v1` para profissionais relacionados por
  `therapy_slug`; a RPC consulta os serviços elegíveis daquela terapia
  diretamente e consolida no máximo um serviço relevante por terapeuta.

As views devem expor somente terapias com `therapies.status = published`, visíveis publicamente e com categoria ativa. O Match usa `public_matching_therapies_v` como projeção única de candidatos; uma terapia só entra no Match se também estiver publicada, com detalhe público elegível e ativa em `matching_therapy_settings`. Elas podem retornar dados editoriais, categoria, contagem de terapeutas disponíveis, sinalizadores de popularidade e novidade. Não expor pesos do Match, dados internos de admin, terapeutas não aprovados, perfis privados ou serviços inativos.

Campos editoriais do detalhe:

- `approach_label`
- `approach_icon_key`
- `visual_theme_key` (`energy`, `oracle`, `systemic`)
- `hero_focal_point` (`left`, `center`, `right`)

Não salvar classes CSS/Tailwind no banco. `visual_theme_key` deve ser mapeado para tokens seguros no frontend.

Escopo editorial atual:

- Publicadas e visíveis no Match: `reiki`, `taro`, `constelacao-familiar`
- Demais terapias permanecem `draft` ou não visíveis em `matching_therapy_settings`
- Não duplicar variações como `tarot`, `tarologia-terapeutica`, `constelacao`
- Não usar “Luto” como interesse do Match atual; usar “Encerrar ciclos” quando necessário.

Para profissionais relacionados:

- consultar `get_public_therapy_therapists_v1` com limite máximo de 6;
- a elegibilidade e a contagem pública usam o mesmo critério: serviço ativo,
  online, reservável, não arquivado, terapia/categoria publicadas e perfil
  publicável;
- sessões concluídas não são exibidas no card relacionado; avaliações públicas
  usam exclusivamente a avaliação canônica `published` e não substituída;
- fora do Match, a ordenação não considera plano. Com `source=match`, interesses
  e temas compatíveis vêm antes e o plano é apenas desempate (`premium_plus`,
  `premium`, `free`);
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
- Detalhe: `TherapyHero`, `TherapyHeroImage`, `TherapyOverview`, `TherapyBenefits`, `RelatedTherapists`, `RelatedTherapistCard`, `PublicTherapistsLowerBanner`
- `PublicFooter`

## Responsividade

- Desktop: hero com imagem lateral, filtros horizontais, sidebar de categorias e grid de 4 colunas.
- Desktop: manter o conteúdo em container central de até `1440px`, com margens laterais de `68px` a partir de `lg`; o cabeçalho público ocupa uma faixa branca própria, separada dos assets do hero.
- Tablet: grid de 2 colunas, filtros acima da listagem.
- Mobile: hero reduzido, busca primeiro, filtros em accordion, grid em 1 coluna quando a descrição precisar respirar.
- Cards do catálogo devem seguir o padrão visual compacto do Figma `13273:1439`: imagem editorial no topo, nome centralizado, descrição com `line-clamp` de 3 linhas e CTA “Saiba mais”. As imagens usam `object-contain`, preservando a composição integral no mobile e em larguras intermediárias; não aplicar zoom de hover que corte a imagem.
- Detalhe desktop: grade editorial única; coluna esquerda com abordagem, nome, subtítulo, três destaques e “O que é”; coluna direita com imagem hero e benefícios; profissionais e banner inferior de descoberta de terapeutas em largura total.
- Detalhe mobile: blocos empilhados, profissionais em uma coluna, banner de descoberta em largura total e sem posicionamento absoluto estrutural.
- Títulos editoriais do detalhe, especialmente o nome da terapia no hero, devem usar `font-display` (`IvyPresto Display`) com tamanho responsivo seguro para nomes longos. UI, formulários, descrições e cards usam Manrope via `font-sans`.
- Cores de títulos devem usar `text-brand-deep`/`text-tesText-primary`; o valor canônico é `#14105A`. Não usar hex hardcoded como `#261433` ou variações próximas em títulos.
- Benefícios do detalhe devem ser cards compactos com ícone e título, sem descrição visível; descrições podem existir no banco para uso futuro/admin, mas a UI pública simplifica o preenchimento.
- A nota de segurança não deve aparecer como card destacado no bloco “O que é”; a responsabilidade editorial deve ficar no texto, metadata ou conteúdo administrado apropriado.
- Profissionais relacionados devem ser cards/lista compacta em duas colunas no desktop quando houver múltiplos resultados, evitando áreas vazias grandes.
- O detalhe termina com o `PublicTherapistsLowerBanner`, compartilhado com a faixa inferior de `/terapeutas`; não há FAQ de terapia.

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
- `/terapias/taro`
- `/terapias/constelacao-familiar`
- slug inexistente em `/terapias/:slug`
- Estado sem Supabase configurado
- Estado sem resultados
- Imagem ausente
- Mobile com filtros recolhidos
- Links para `/terapias/:slug`
- Links de detalhe para `/terapeutas?therapy=:slug&source=*`
- Links de card para `/terapeutas/:slug?therapy=:slug&source=*`
- Conferir que o detalhe vindo do Match mostra no máximo 6 profissionais, ou
  somente os existentes quando houver menos, sem placeholders.
- Favoritar anônimo encaminha para login de cliente
- Verificar que só Reiki, Tarô e Constelação Familiar aparecem como `published` e visíveis no Match nesta fase.

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
- Criar interface admin para `approach_label`, `approach_icon_key`, `visual_theme_key` e `hero_focal_point`.

## Assets da plataforma

- O hero usa `publicTherapiesHero` ancorado à direita. Os cards da listagem
  preservam as imagens editoriais oficiais de cada terapia (`imageUrl`); a
  ilustração `publicTherapiesCard` fica somente no quadro “Não encontrou o que
  procura?”, sem alterar o contrato do catálogo.
- Uploads administrativos de terapia usam o bucket público
  `admin-public-media`. A imagem do detalhe prioriza `hero_image_url`, mas usa
  `image_url` como fallback quando não houver hero dedicado, preservando a
  mesma experiência das imagens editoriais locais.
- Consulte `docs/design-system/platform-assets.md`.
