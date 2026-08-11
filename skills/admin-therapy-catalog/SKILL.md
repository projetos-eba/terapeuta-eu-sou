# Admin Therapy Catalog

Use esta skill ao alterar `/admin/terapias`, contratos de administração de
terapias, `/admin/matching`, requests de catálogo, auditoria ou integrações
públicas dependentes do catálogo canônico e da taxonomia do Match.

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
- `supabase/migrations/*matching*`
- `supabase/functions/admin-therapy-catalog-command/*`
- planilhas aprovadas de categoria/refinamento quando usadas como fonte de seed

## Rotas

- `/admin-login`
- `/admin`
- `/admin/terapias`
- `/admin/matching`
- `/api/admin/media`
- `/api/admin/therapies`

## Componentes e Dados

- `AdminTherapyCatalogPage`
- `AdminTherapyEditor`
- `admin-therapy-catalog.parsers.ts`
- `admin-therapy-catalog.queries.ts`
- `admin-therapy-catalog.commands.ts`
- `AdminMatchingPage`
- `admin-matching.parsers.ts`
- `admin-matching.commands.ts`

## Contrato visual

- Usar o ritmo dos padrões administrativos do Figma, node `12857:666`:
  cabeçalho editorial sem card externo, conteúdo com largura máxima de
  `1166px`, KPIs compactos, cards com raio de 24 a 28px e painéis laterais
  contidos no grid.
- `/admin/terapias` prioriza catálogo, publicação, presença no Match, impacto e
  solicitações. Não renderizar nomes de tabelas ou contratos internos.
- `/admin/matching` prioriza temas, refinamentos, vínculos e regras da jornada.
  Slugs continuam no formulário por necessidade editorial, apresentados como
  `Endereço amigável`; não devem dominar cards ou resumos.
- Mensagens de falha recebidas dos comandos não são propagadas diretamente ao
  usuário. A interface usa copy fixa de produto e os detalhes permanecem nos
  canais de diagnóstico.

Dados vêm de `admin_list_therapy_catalog_v1`, `admin_therapy_impact_v1`,
`admin_upsert_therapy_draft_v1`, `admin_transition_therapy_v1` e
`admin_decide_therapy_catalog_request_v1`. Temas e refinamentos do Match vêm
do contrato admin `admin_list_matching_v1`; páginas administrativas não devem
depender exclusivamente de views públicas como `public_matching_config`.
Imagens administrativas públicas, como prévias de temas do Match, usam o
bucket `admin-public-media` e são enviadas por `/api/admin/media` com token do
admin autenticado, sem `service_role` no frontend.

## Regras

- Terapia da plataforma é canônica e só nasce por ação admin/plataforma.
- Terapeuta pode solicitar análise, mas a aprovação não publica texto livre.
- Publicação, Match e disponibilidade para novos serviços são estados
  separados.
- Terapias selecionam de 1 a 3 temas canônicos do Match; admin não seleciona
  refinamentos por terapia.
- Temas/refinamentos de Match devem ser sincronizados por migration idempotente
  quando vierem de planilha aprovada, preservando vínculos existentes e
  desativando apenas legado sem vínculo operacional.
- `therapy_matching_themes` é a relação canônica entre terapia e temas.
- Não persistir classes CSS/Tailwind no banco; usar chaves semânticas.
- Chave semântica de cor deve ser selecionada em lista fechada alinhada a
  tokens TES, não como texto livre.
- Benefícios e FAQs devem ser editados em campos estruturados; FAQ separa
  pergunta e resposta.
- Benefícios devem selecionar `iconKey` por lista fechada compartilhada com a
  página pública da terapia; não aceitar chaves livres que a página pública não
  renderiza.
- Temas do Match exibidos no cadastro de terapia devem mostrar a mesma prévia
  visual usada na jornada pública sempre que `matching_themes.image_url`
  existir.
- Terapias podem selecionar de 1 a 3 temas do Match. `category_id` permanece
  uma categoria canônica singular da terapia.
- Edição de imagem de tema aceita URL e upload de arquivo JPG, PNG ou WebP,
  com preview antes de salvar.
- Toda ação de governança exige motivo e gera auditoria.
- Remover tema do Match de uma terapia deve identificar servicos e
  refinamentos afetados e bloquear a alteracao enquanto houver configuracao
  operacional dependente. A auditoria registra o bloqueio e o resumo de impacto;
  nao apagar vinculos, servicos, bookings, snapshots ou pagamentos de forma
  silenciosa.
- Não apagar serviços, bookings, snapshots ou pagamentos ao descontinuar.

## QA

- Testar filtros, busca, criação de rascunho, edição, publicação bloqueada por
  conteúdo incompleto, despublicação, descontinuação e decisão de request.
- Testar clique real em login/admin, modal de tema, foco durante digitação,
  slug automático, lista de temas ativa no cadastro de terapia e payload
  estruturado de benefícios/FAQs.
- Testar preview das imagens de temas no cadastro de terapia e upload de
  imagem no modal de tema sem salvar alterações destrutivas durante QA.
- Testar seleção de três temas do Match e bloqueio visual de novas seleções ao
  atingir o limite.
- Validar RLS admin, terapeuta e visitante em pgTAP.
- Confirmar revalidação de `therapies`, `matching-config`,
  `therapist-search`, `therapist-profile` e `therapist-services`.
- Verificar responsividade em 320, 375, 768, 1024 e 1440 px quando houver
  mudança visual.
- Validar com Playwright a ausência de overflow horizontal, abertura dos
  diálogos e foco dos campos, sem salvar mutações durante QA visual.

## Copy responsável

Evite promessas de cura, diagnóstico, transformação garantida ou resultado
garantido em conteúdo editorial e mensagens administrativas.

## Pendências conhecidas

- `/admin` possui visão geral funcional do catálogo/Match e não redireciona
  automaticamente para `/admin/terapias`.
- `/admin/matching` possui primeira superfície operacional de leitura para
  temas, vínculos e regras ativas.
- Painel dedicado `/admin/matching` governa leitura e mutações básicas de
  temas/refinamentos com motivo de auditoria; publicação explícita de versões
  segue como evolução de governança.
- Criação assistida de rascunho a partir de solicitação deve continuar manual
  até haver fluxo editorial aprovado.
