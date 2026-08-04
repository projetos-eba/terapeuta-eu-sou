# Admin Therapy Catalog

Use esta skill ao alterar `/admin/terapias`, contratos de administração de
terapias, requests de catálogo, auditoria ou integrações públicas dependentes
do catálogo canônico.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/architecture/admin-therapy-catalog-phase3.md`
- `docs/architecture/therapy-service-foundation-phase1.md`
- `docs/product/integration-map.md`
- `docs/product/page-inventory.md`
- `docs/product/routes-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `supabase/migrations/*therapy*`
- `supabase/functions/admin-therapy-catalog-command/*`

## Rotas

- `/admin-login`
- `/admin`
- `/admin/terapias`
- `/api/admin/therapies`

## Componentes e Dados

- `AdminTherapyCatalogPage`
- `AdminTherapyEditor`
- `admin-therapy-catalog.parsers.ts`
- `admin-therapy-catalog.queries.ts`
- `admin-therapy-catalog.commands.ts`

Dados vêm de `admin_list_therapy_catalog_v1`, `admin_therapy_impact_v1`,
`admin_upsert_therapy_draft_v1`, `admin_transition_therapy_v1` e
`admin_decide_therapy_catalog_request_v1`.

## Regras

- Terapia da plataforma é canônica e só nasce por ação admin/plataforma.
- Terapeuta pode solicitar análise, mas a aprovação não publica texto livre.
- Publicação, Match e disponibilidade para novos serviços são estados
  separados.
- Terapias selecionam de 1 a 3 temas canônicos do Match; admin não seleciona
  refinamentos por terapia.
- `therapy_matching_themes` é a relação canônica entre terapia e temas.
- Não persistir classes CSS/Tailwind no banco; usar chaves semânticas.
- Toda ação de governança exige motivo e gera auditoria.
- Não apagar serviços, bookings, snapshots ou pagamentos ao descontinuar.

## QA

- Testar filtros, busca, criação de rascunho, edição, publicação bloqueada por
  conteúdo incompleto, despublicação, descontinuação e decisão de request.
- Validar RLS admin, terapeuta e visitante em pgTAP.
- Confirmar revalidação de `therapies`, `matching-config`,
  `therapist-search`, `therapist-profile` e `therapist-services`.
- Verificar responsividade em 320, 375, 768, 1024 e 1440 px quando houver
  mudança visual.

## Copy responsável

Evite promessas de cura, diagnóstico, transformação garantida ou resultado
garantido em conteúdo editorial e mensagens administrativas.

## Pendências conhecidas

- `/admin` possui visão geral funcional do catálogo/Match e não redireciona
  automaticamente para `/admin/terapias`.
- `/admin/matching` possui primeira superfície operacional de leitura para
  temas, vínculos e regras ativas.
- Painel dedicado `/admin/matching` ainda precisa governar mutações completas
  de temas/refinamentos e publicação de versões, sem apagar histórico.
- Criação assistida de rascunho a partir de solicitação deve continuar manual
  até haver fluxo editorial aprovado.
