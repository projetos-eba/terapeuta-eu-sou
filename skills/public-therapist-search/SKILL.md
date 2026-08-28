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
- CTA primário do card de resultado: `Ver perfil` para
  `routes.public.therapistProfile(slug)`. A reserva começa no perfil, não na
  busca. O card também oferece o affordance secundário de favorito com
  `FavoriteTherapistButton`.
- Favoritos usam o `therapist_profile_id` da projeção pública e o contrato
  autenticado `/api/patient/favorite-therapists`. Sem sessão, o componente
  preserva a URL atual no redirecionamento para login; com sessão, a mudança é
  otimista, reversível e sincronizada com `/app/favoritos/terapeutas`.
- Não criar `/terapeutas/:slug` dentro desta skill; registrar como pendência até a página de perfil ser implementada.

## Dados

- Fonte dinâmica pública: view Supabase `public_therapist_search` para o
  serviço principal do card e `public_therapist_profile_services_v` para a
  lista completa de terapias publicadas por terapeuta.
- Integração: REST fetch com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Não adicionar `@supabase/supabase-js` sem decisão explícita.
- Fallback local obrigatório em `src/features/public-therapist-search/content.ts`.
- Seeds/mocks: manter 5 terapeutas em `supabase/seed.sql`, com `ana-oliveira` como perfil principal mais rico.
- Fotos públicas de terapeutas devem usar os assets versionados em `public/therapists/`, mantendo URLs rastreáveis nos seeds, fallbacks e views: `ana-oliveira.png`, `rafael-santos-avatar.png`, `celia-martins.png`, `juliana-costa.png`, `lucas-pereira-avatar.png`, `andre-lima.png` e `marcio-andrade.png`.
- Toda alteração em view/schema/policy exige migration versionada. Todo mock/seed deve ser idempotente.
- A busca deve preservar o serviço principal retornado por
  `public_therapist_search` para preço, duração e reserva, mas enriquecer o
  card com todas as terapias reais de `public_therapist_profile_services_v`.
  A apresentação mostra até duas terapias e um badge `+N` visualmente pequeno
  sobreposto à última etiqueta visível; o alvo interativo continua com no
  mínimo `44px`, e os nomes restantes devem estar disponíveis em hover, foco e
  clique, com tooltip acessível e fechamento por `Escape`.
- `next_slot_at` é derivado pelo mesmo RPC autoritativo usado pela agenda pública:
  `get_service_available_slots_v1`. A view não pode estimar o próximo horário
  apenas pela regra semanal, porque isso ignora antecedência, buffers,
  exceções, reservas e holds ativos.
- `schedule_timezone` acompanha a projeção pública e deve ser usado para
  classificar e formatar “Hoje”, “Amanhã” e dias da semana; instantes continuam
  persistidos como UTC.
- Nota, contagem e trecho de avaliação usam somente avaliações canônicas
  `published` e não substituídas de
  `public_therapist_profile_reviews_v_internal`. Depois de publicada, a
  avaliação não volta a depender da reserva ou pagamento que qualificou a
  relação; a elegibilidade pública do perfil continua no wrapper da view.
- A consulta que alimenta os cards usa `no-store`, porque bookings e holds
  podem mudar o próximo horário sem uma publicação editorial do perfil. Não
  reintroduzir cache de 15 minutos nessa projeção sem um mecanismo equivalente
  de invalidação de disponibilidade.

Regra de apresentação dos cards:

- O texto exibido no card deve vir da apresentação curta publicada do terapeuta
  (`therapist_headline`), com copy visual chamada “Sua apresentação”.
- Nunca usar `service_description` como apresentação do terapeuta; essa
  descrição pertence à oferta e aparece somente em contextos de serviço.
- O card público não exibe tags de cuidado ou temas derivadas de
  `therapist.tags`. Os chips visíveis junto ao nome ficam restritos às terapias
  publicadas, com no máximo duas e o contador acessível das demais.
- O card tem somente o CTA primário `Ver perfil`; não exibe `Agendar sessão`
  nem o texto “Ver perfil completo”. O favorito é uma ação secundária,
  disponível apenas para a pessoa paciente autenticada.

## Componentes Esperados

- `PublicHeader`
- hero público com copy acolhedora
- formulário de busca e filtros linkáveis por URL
- contagem de resultados e ordenação
- cards de terapeuta com foto, terapias, avaliação, preço, próxima disponibilidade, favorito e CTA de perfil
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
- O hero deve aproveitar a largura disponível sem criar gap visual no lado direito: mídia ancorada à direita, container central de `1440px` e margens de `68px`; o `PublicHeader` permanece em faixa branca própria para não receber a imagem do hero como fundo.
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
- Favoritos aparecem como ação secundária nos cards e persistem somente para a
  pessoa paciente autenticada pelo contrato de favoritos existente. O estado
  anônimo nunca é apresentado como salvo.

## Checklist de QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`
- Se Docker/Supabase local permitir: `npx supabase db reset` e conferir a view `public_therapist_search`.
- Validar URLs: `/terapeutas`, `/terapeutas?q=ana`, `/terapeutas?therapy=reiki`, `/terapeutas?therapy=taro`, `/terapeutas?therapy=constelacao-familiar`, `/terapeutas?price=100-150`, `/terapeutas?rating=4-plus`, `/terapeutas?sort=price_asc`, `/terapeutas?page=2`.
- Validar responsividade desktop/mobile contra o Figma `13273:3587`.
- Confirmar que a view não expõe email, telefone, dados internos de paciente, dados sensíveis, `meeting_url` ou campos privados.
- Confirmar que um terapeuta com três ou mais terapias mostra duas etiquetas,
  o contador sobreposto à última etiqueta, alvo de toque de 44px e os nomes
  completos no tooltip; validar foco, clique e `Escape`, sem misturar temas de
  cuidado com terapias.
- Confirmar que a busca não exibe `Agendar sessão` ou “Ver perfil completo”.
- Validar o favorito em cada card: leitura do estado autenticado, adicionar,
  remover, rollback em erro e redirecionamento para login sem sessão,
  preservando os filtros da URL.

## Pendências Conhecidas

- Conectar reserva real ao serviço/horário escolhido.
- Validar continuamente a equivalência entre `public_therapist_search.next_slot_at`
  e o primeiro slot de `get_service_available_slots_v1` quando o contrato de
  agenda for alterado.
- A disponibilidade pública já considera exceções, conflitos, reservas,
  holds, buffers, antecedência, duração e timezone por meio do motor A5.

## Assets da plataforma

- O hero e o CTA inferior usam `publicTherapistsHero` e
  `publicTherapistsLowerBanner`, ancorados à direita e com fade curto na borda
  de leitura; o banner mantém copy HTML e não usa a exportação Figma que já
  contém texto.
- Consulte `docs/design-system/platform-assets.md`.
