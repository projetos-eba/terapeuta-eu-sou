# Administração do Catálogo de Terapias - Fase 3

Data: 2026-07-28

## Objetivo

Fase 3 cria a superfície administrativa para governar Terapias da Plataforma e
mantém Serviços do Terapeuta, catálogo público, Match, busca, perfil, reserva,
agenda e métricas usando as mesmas fontes de verdade.

## Mapa Final do Domínio

| Área                   | Fonte de verdade                                                                   | Mutação                                   | Exposição                                               |
| ---------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Terapia canônica       | `therapies`                                                                        | Admin via `admin-therapy-catalog-command` | Views públicas e catálogo privado filtrados             |
| Categoria              | `therapy_categories`                                                               | Admin/plataforma                          | Pública somente quando ativa                            |
| Conteúdo público       | `therapy_public_content`, `therapy_highlights`, `therapy_benefits`, `therapy_faqs` | Admin                                     | `/terapias` e `/terapias/:slug`                         |
| Match                  | `matching_therapy_settings`, `therapy_matching_themes`, `matching_versions`, `matching_weights` | Admin/Match                               | `public_matching_config`, `public_matching_therapies_v` |
| Serviço do terapeuta   | `therapist_services`                                                               | Terapeuta via autoridade da Fase 1        | Perfil, busca, agenda e reserva                         |
| Redirect de slug       | `therapy_slug_redirects`                                                           | Admin                                     | `public_therapy_slug_redirects_v`                       |
| Solicitação de terapia | `therapy_catalog_requests`                                                         | Terapeuta cria, admin decide              | Admin e solicitante                                     |
| Auditoria              | `therapy_catalog_events`                                                           | RPCs admin                                | Admin                                                   |

## Fluxos Administrativos

1. Admin entra em `/admin-login` e recebe sessão admin em cookie HTTP-only.
2. `/admin/terapias` carrega catálogo, categorias, requests, impacto e eventos
   recentes por `/api/admin/therapies`.
3. Criação de rascunho chama `admin_upsert_therapy_draft_v1` com identidade e
   conteúdo inicial; nenhuma tela de terapeuta cria terapia canônica.
4. Edição salva identidade, editorial e disponibilidade usando chaves
   semânticas, sem classes Tailwind/CSS no banco.
5. Publicação chama `admin_transition_therapy_v1` e valida categoria ativa,
   slug único, conteúdo mínimo, copy responsável, ao menos um tema canônico do
   Match e integridade editorial.
6. Despublicação remove a superfície pública sem apagar histórico.
7. Descontinuação impede novos serviços, preserva serviços existentes,
   bookings, snapshots e pagamentos.
8. Arquivamento é bloqueado quando houver serviços vinculados.
9. Solicitações de nova terapia são decididas pelo admin e podem ser vinculadas
   a uma terapia canônica; aprovação não publica automaticamente o texto livre.
10. A solicitação estruturada do terapeuta usa o contrato versionado v2,
    idempotência, materiais em bucket privado e estados `submitted`,
    `under_review`, `needs_information`, `approved`, `merged` e `rejected`.
    Toda decisão exige motivo, gera auditoria, notificação interna e tentativa
    de e-mail, sem reverter uma decisão confirmada em caso de falha de entrega.

## Matriz de Estados

| Estado       | Público                        | Novos serviços                      | Match                               | Histórico                    |
| ------------ | ------------------------------ | ----------------------------------- | ----------------------------------- | ---------------------------- |
| `draft`      | Não                            | Não                                 | Não                                 | Interno admin                |
| `in_review`  | Não                            | Não                                 | Não                                 | Interno admin                |
| `published`  | Sim, se `is_public_visible`    | Sim, se `is_available_for_services` | Sim, se settings e pesos publicados | Sim                          |
| `deprecated` | Opcional conforme visibilidade | Não                                 | Não                                 | Sim                          |
| `archived`   | Não                            | Não                                 | Não                                 | Referência histórica somente |

Serviços preservam os estados da Fase 1: `draft`, `active`, `paused`,
`requires_review`, `rejected`, `archived`.

## Matriz de Impacto

| Ação         | Serviços                | Bookings                      | Catálogo                            | Match                      | Busca/perfil                    |
| ------------ | ----------------------- | ----------------------------- | ----------------------------------- | -------------------------- | ------------------------------- |
| Publicar     | Não altera              | Não altera                    | Pode aparecer                       | Pode entrar se configurada | Filtros passam a considerar     |
| Despublicar  | Não altera              | Não altera                    | Sai                                 | Sai                        | Serviços podem manter histórico |
| Descontinuar | Bloqueia novos serviços | Preserva                      | Pode continuar editorial se visível | Sai                        | Serviços existentes preservados |
| Arquivar     | Só sem serviços         | Preserva snapshots existentes | Sai                                 | Sai                        | Não entra em novas superfícies  |
| Mudar slug   | Não altera              | Não altera                    | Redirect persistente                | Recalcula candidatos       | Canonical atualizado            |

## Migrations

- `20260728103000_admin_therapy_catalog_phase3.sql`
  - adiciona `deprecated_at`, `archived_at` e `replacement_therapy_id`;
  - cria `therapy_slug_redirects`, `therapy_catalog_requests` e
    `therapy_catalog_events`;
  - cria policies admin explícitas e view pública segura de redirects;
  - adiciona RPCs admin de listagem, impacto, edição, transição e decisão;
  - ajusta `public_matching_therapies_v` para exigir terapia publicada,
    settings ativos e pesos de versão publicada.

## APIs

- `POST /api/admin/therapies`: adaptador Next fino, sem service role.
- `admin-therapy-catalog-command`: Edge Function autenticada.
- Ações: `list`, `impact`, `save`, `transition`, `decideRequest`,
  `submitRequest`.

## Cache e Revalidação

Após mutações, o adaptador revalida tags e caminhos afetados:

- tags: `therapies`, `matching-config`, `therapist-search`,
  `therapist-profile`, `therapist-services`;
- paths: `/terapias`, `/terapias/[slug]`, `/terapeutas`,
  `/terapeutas/[slug]`, `/sua-jornada`, `/sua-jornada/resultado`.

## Observabilidade e Auditoria

As mutações relevantes gravam `therapy_catalog_events` com ator, entidade,
estado anterior, estado posterior, motivo, `request_id` e `correlation_id`.
Falhas de publicação, conflito, uso por serviços, revalidação e acesso negado
são registradas de forma estruturada, sem secrets.

## Riscos Restantes

- `/admin/matching` possui gestão operacional de temas e refinamentos com
  criação, edição, ativação/desativação, motivo obrigatório, `request_id` e
  auditoria. Governança avançada de aprovação editorial pode evoluir depois.
- `matching_weights` permanece legado compatível. A recomendação de terapias
  passa a usar `therapy_matching_themes`: temas recomendam terapias;
  refinamentos ordenam terapeutas dentro da terapia.
- Aprovação de solicitação vincula ou decide o request, mas a criação assistida
  de rascunho a partir da solicitação permanece manual para evitar promover
  texto livre automaticamente.
- A UI admin é funcional e responsiva, mas ainda não substitui um painel
  administrativo completo de governança editorial.

## Checklist para Homologação

- Login admin real e expiração de sessão.
- Criar rascunho, editar, tentar publicar incompleto e publicar completo.
- Trocar slug e confirmar redirect antigo sem cadeia.
- Descontinuar terapia com serviço ativo e confirmar que bookings/snapshots não
  mudam.
- Confirmar que terapeuta não cria terapia por texto livre.
- Confirmar que `/terapias`, Match, `/terapeutas`, perfil público e reserva
  refletem estados distintos.
- Revisar eventos em `therapy_catalog_events` sem payload sensível.
