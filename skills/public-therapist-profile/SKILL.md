---
name: public-therapist-profile
description: Use when implementing, refactoring, auditing, or documenting the public therapist profile page `/terapeutas/:slug`, including Figma node 13273:3393, public Supabase views, therapist profile content, services, availability slots, booking handoff, reviews carousel, SEO, redirects, seeds, and QA.
---

# Public Therapist Profile

## Fontes obrigatórias

Consultar antes de alterar:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:3393`
3. `src/lib/routes.ts`
4. `src/app/terapeutas/[slug]/`
5. `src/features/therapist-profile/`
6. `src/features/availability/`
7. `src/features/booking/`
8. `supabase/migrations/*public_therapist_profile*.sql`
9. `supabase/seed.sql`
10. `docs/product/routes-map.md` e `docs/product/page-inventory.md`

## Contrato

- Rota canônica: `/terapeutas/:slug`.
- Rota singular `/terapeuta/:slug`: redirect para a plural.
- Figma: `13273:3393`.
- Perfil principal de teste: `ana-oliveira`.
- Slugs seedados como `rafael-santos` devem aparecer quando tiverem perfil aprovado, serviço ativo e terapia `published` com `is_public_visible = true`.
- O fallback local de desenvolvimento cobre `ana-oliveira` e `rafael-santos` para evitar tela de não encontrado quando o Supabase local estiver indisponível.
- Fotos públicas devem apontar para assets versionados em `public/therapists/`. Não usar URLs temporárias, imagens externas ou nomes novos sem atualizar seeds, fallbacks e documentação.
- Não expor email, telefone, dados internos de paciente, `meeting_url`, dados de pagamento ou campos privados.

## Dados

- Views públicas:
  - `public_therapist_profiles_v`
  - `public_therapist_profile_services_v`
  - `public_therapist_profile_reviews_v`
  - `public_therapist_profile_content_v`
  - `public_therapist_slug_redirects_v`
- Conteúdo editorial publicado vem de `therapist_profile_content_versions` e tabelas filhas.
- `public_profile_theme` aplica um dos dezenove temas oficiais ao hero e ao
  recorte da foto. Os quatro IDs legados (`serene`, `natural`, `warm` e
  `essential`) continuam Free; quinze novos IDs são Premium/Premium Plus.
  `bio_illustration_id` permanece compatível nos dados publicados, mas não é
  renderizado na página pública. Não limpar, renomear ou criar consumidor do
  campo fora de uma mudança de domínio planejada.
- Slugs antigos resolvem por `public_therapist_slug_redirects_v`. A projeção
  nunca expõe `free_public_slug`, IDs de histórico ou proprietário de slug.
- Terapias e serviços são gerenciados pela plataforma/Admin, não pela copy livre do terapeuta.
- Avaliações públicas derivam da avaliação canônica `published` e não
  substituída da relação paciente–terapeuta. A criação inicial exige uma
  confirmação `completed` da pessoa paciente; depois de publicada, sua
  visibilidade não volta a depender de booking ou pagamento.
- Disponibilidade deve vir dos RPCs autoritativos `get_service_available_slots_v1`, `get_service_available_days_v1` e `get_service_available_day_slots_v1`, que derivam regras semanais, exceções, bookings existentes, buffers, antecedência mínima, duração e timezone do serviço. Não recalcular slots públicos no runtime Next.
- A lista pública `/terapeutas` usa a mesma autoridade: `next_slot_at` da view
  `public_therapist_search` é projetado a partir do primeiro slot do RPC e
  `schedule_timezone` deve ser respeitado na apresentação. Uma previsão de
  regra semanal não é uma fonte válida de disponibilidade.
- Cada serviço deve carregar sua própria grade de horários calculada; Reiki 50min, Tarô 60min e Constelação Familiar 60min não podem compartilhar uma lista fixa de slots.
- O painel compacto de disponibilidade mostra somente os próximos 3 dias com horários disponíveis; dias corridos sem slot não devem aparecer como linhas vazias.
- O painel compacto consulta somente a primeira semana. A agenda mensal consulta dias livres por mês e busca os horários somente depois da seleção do dia; o limite de slots detalhados não pode limitar a navegação mensal.
- O horizonte canônico é de 90 dias por serviço. O modal usa `horizonEndsAt` retornado pelo banco para desabilitar a navegação apenas após o último mês parcialmente coberto e usa `TESDialog` para foco, `Escape`, overlay e retorno de foco.
- Falha de disponibilidade deve aparecer como falha acionável, nunca como mês sem horários.
- As views de perfil público devem usar o status atual do catálogo público: `therapies.status = 'published'` e `therapies.is_public_visible = true`.

## UI

Preservar o padrão do node:

- Hero com foto grande, badges, avaliação, CTA e ações favoritar/compartilhar;
  não exibir chips derivados de `therapist.tags` no perfil público.
  Favoritos são exclusivos de paciente autenticado, persistem em
  `favorite_therapists` e sincronizam com `/app/favoritos/terapeutas`; sem
  sessão, a ação encaminha ao login de cliente e retorna ao mesmo perfil.
  Compartilhar usa apenas a URL canônica `/terapeutas/:slug`, sem parâmetros,
  dados privados ou textos promocionais.
- O hero consome a camada visual oficial em
  `public/therapists/profile-themes/`. Os quinze backgrounds da biblioteca
  foram exportados do Figma `Z42SR0Pi0m307SmcAkDqHb`, nó `14869:2`, e ficam
  versionados em `library/`; os quatro temas legados preservam seus assets e
  composição. Fundo e arte são decorativos (`alt=""`) e aparecem somente no
  hero.
- Cards `Minha essência`, `Como posso te guiar` e `Um convite para você`.
- No card `Um convite para você`, o vídeo ocupa a primeira linha e o texto de
  convite aparece abaixo dele em todos os breakpoints; não usar composição
  lateral para esse conteúdo.
- No tablet, o hero deve preservar a leitura lado a lado: foto em uma coluna e a apresentação/bio com badges, avaliação e CTA na coluna vizinha. No mobile, o conteúdo volta a uma coluna; no desktop, mantém a composição ampla do Figma.
- No mobile, o hero usa banner no topo com retrato circular sobreposto, ações
  de busca/menu no cabeçalho, CTA em largura total e ações circulares de
  favorito/compartilhamento. Os cards editoriais seguem a ordem essência,
  guia e convite; o guia exibe no máximo quatro temas com ícones. Quando houver
  quatro escolhas, a composição usa duas colunas e duas linhas, com respiro
  suficiente entre ícones e textos.
- O hero público usa composição compacta: o fundo temático ocupa menos altura, o
  retrato é reduzido em 30% em cada breakpoint principal e os badges de
  verificação/plano permanecem lado a lado, com tipografia compacta e sem
  overflow horizontal em larguras móveis usuais.
- No mobile, serviços ficam fora do fluxo principal da referência e continuam
  disponíveis no desktop; disponibilidade e avaliações aparecem em sequência,
  com quatro horários visíveis por dia em uma grade 2x2 e o quinto horário
  preservado a partir do breakpoint de tablet, estado vazio de avaliações
  ilustrado e rodapé em card com grupos institucionais, para terapeutas e
  suporte/legal.
- O registro compartilhado de temas alimenta editor, hero e snapshots; não
  duplicar componentes de perfil. O `photoShape` é determinístico por `themeId`.
- Seção `Vivências e terapias` com serviços, duração, preço e CTA.
- A seção `Vivências e terapias` usa a terapia canônica como identidade
  pública. Não exibir títulos operacionais de serviço como chip/aba, por
  exemplo “Reiki online”.
- Painel roxo `Próximos horários disponíveis` com seleção de serviço quando houver mais de uma oferta ativa.
- Avaliações em carrossel automático sem dependência nova. Respostas do
  terapeuta aparecem inicialmente com uma frase e expandem sob ação explícita.
- Copy responsável, sem promessa de cura, diagnóstico ou resultado garantido.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint`
- Se Docker estiver disponível: `npx supabase db reset`
- Validar `/terapeutas/ana-oliveira`, `/terapeuta/ana-oliveira`, perfil inexistente, sem avaliações, agenda indisponível e slots diferentes para 50min vs 60min.
- Validar no card `Um convite para você` que o texto permanece abaixo do vídeo
  em desktop e mobile.
- Validar o perfil em viewport mobile, conferindo banner temático compacto,
  retrato reduzido, badges lado a lado, três cards editoriais, painel com
  quatro horários por dia em grade 2x2,
  estado vazio de avaliações e rodapé em card; confirmar que o quinto horário
  reaparece no tablet/desktop e que o cabeçalho padrão e o rodapé padrão
  permanecem inalterados nas demais páginas públicas.
- Validar favorito sem sessão, favorito/remover com paciente autenticado e
  sincronização com o painel de Favoritos. Validar Web Share e fallback de
  cópia com a URL canônica sem query string.
