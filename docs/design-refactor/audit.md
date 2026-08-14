# Auditoria do sistema visual TES

Data: 2026-08-13  
Escopo: repositório local, GitHub, Figma, documentação, componentes, rotas,
skills, scripts e trabalho recente da Agenda.  
Natureza: fundação; nenhuma página foi redesenhada.

## Fontes verificadas

- GitHub `projetos-eba/terapeuta-eu-sou`, branch padrão `main` e commits recentes.
- `AGENTS.md`, `README.md`, `package.json`, `tailwind.config.ts`,
  `components.json`, `src/app/globals.css`, `src/lib/routes.ts` e permissions.
- `docs/design-system/`, `docs/architecture/`, sitemap, routes map, glossary e page inventory.
- `src/components/`, `src/components/tes/`, `src/components/app-page/` e componentes locais.
- rotas e features de Público, Paciente, Terapeuta e Admin.
- skills locais, com atenção a `therapist-agenda-sessions`.
- scripts de política visual e testes Playwright existentes.
- Figma `OSXJi8tknHHCj82MTY2NbG`: jornadas `12272:2`, telas `5999:10563`,
  sitemap `12259:2`, Design System `12304:2` e Agenda `13366:5342`.

O MCP retornou metadata real desses nodes. O frame Agenda confirma grande
quantidade de rounded rectangles, cards, badges e microtexto em heatmap; portanto
Figma é referência relevante, mas também contém os problemas que esta iniciativa
deve corrigir de forma documentada.

## Histórico recente relevante

| Referência                                  | Evidência                                     | Leitura para a iniciativa                                                |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| GitHub `main` `70e3919`                     | merge da PR #102, “Ajuste horário compatível” | faixa temporal da Agenda deixou de assumir apenas horário comercial fixo |
| local `b6ac48e4`                            | “Ajuste horário compatível”                   | consolida comportamento de madrugada/range derivado                      |
| local `898c6e13`                            | “Refatoração terapeuta 1 + Skill”             | primeira experiência de redesign com skill de página e QA visual         |
| commits de Admin e superfícies operacionais | correções recentes de consistência e fluxo    | mostram evolução incremental, ainda sem language/gate transversal        |

Os commits foram lidos como evidência de direção, não como autorização para
refatorar arquivos adicionais nesta etapa.

## Diagnóstico executivo

1. O sistema tem tokens, documentação e componentes úteis, mas não havia uma
   camada canônica entre tokens e páginas: Experience Language, densidade,
   composition patterns e quality gate.
2. A consistência atual depende muito de wrappers que sempre aplicam card,
   border, radius e shadow. `AppPageHeader`, `AppPageSection` e `TESCard` tornam
   a cardificação estrutural, não apenas escolha local.
3. Público, Paciente, Terapeuta e Admin compartilham cor e radius, mas não uma
   regra explícita de como variar densidade e personalidade sem se fragmentar.
4. O código possui primitives úteis, especialmente `TESDialog`, mas mantém
   equivalentes locais para status, filtros, headers, métricas e empty states.
5. A documentação histórica é ampla, porém mistura estado planejado e real,
   nomes comerciais legados e recomendações de Storybook ainda não implementadas.
6. A Agenda recente foi uma boa prova de responsividade e integração real, mas
   concentrou regras visuais universais na skill de domínio e continua exposta
   à linguagem visual card-heavy do Figma e dos wrappers existentes.

## Evidência quantitativa

Busca estática em `src/features/**/*.tsx`:

| Sinal                              | Ocorrências |
| ---------------------------------- | ----------: |
| `rounded`                          |       1.230 |
| `border`                           |       1.748 |
| `shadow`                           |         266 |
| termo/classe relacionado a `card`  |         838 |
| tamanhos arbitrários `8/9/10/11px` |         140 |
| hex arbitrário em TS/TSX           |         194 |
| radius arbitrário                  |         291 |
| widths arbitrárias                 |         353 |

Contagem não prova erro isoladamente. A concentração em `admin-operations`,
`therapist-finance`, `admin-finance` e `therapist-agenda` indica, contudo, que
densidade vem sendo resolvida principalmente com containers e limites.

## Matriz de interfaces

As linhas agrupam páginas com o mesmo objetivo e composição para manter a
auditoria acionável. Rotas compatíveis/legadas não recebem nova direção visual.

| Rota ou grupo                                                                    | Usuário e objetivo                                  | Tarefa                  | Densidade atual             | Componentes/padrões predominantes                                    | Problema ou inconsistência                                                                                                                   | Risco   | Prioridade                 |
| -------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------- | --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------- |
| `/`, `/sobre-nos`, `/para-terapeutas`                                            | Público; compreender proposta e avançar             | descoberta/narrativa    | Comfortable                 | hero, seções, cards, FAQ, CTA                                        | composição premium existe, mas cards e gradientes podem virar assinatura superficial; fallback local documentado conflita com política atual | médio   | P2                         |
| `/sua-jornada`, `/sua-jornada/resultado`                                         | Público; receber orientação sem diagnóstico         | decisão guiada          | Comfortable/Balanced        | etapas, seletores, resultado cards, CTA                              | resultado concentra conteúdo em cards e pode parecer recomendador genérico; preservar copy responsável                                       | alto    | P1 após benchmarks         |
| `/terapeutas`, `/terapeutas/:slug`                                               | Público; comparar e escolher profissional           | busca/comparação        | Balanced                    | FilterBar local, TherapistCard, badges, disponibilidade              | muitos badges/CTAs e cards densos; rota legada `/terapeuta/:slug` ainda existe no app fora da rota canônica                                  | alto    | P2                         |
| `/terapias`, `/terapias/:slug`                                                   | Público; aprender e avançar para profissionais      | catálogo/editorial      | Comfortable/Balanced        | busca, chips, sidebar, grids de cards                                | grid tende a uniformizar conteúdos; alternância editorial/operacional pouco formalizada                                                      | médio   | P2                         |
| `/reserva`, `/reserva/sucesso`                                                   | Público/paciente; selecionar horário e contratar    | transacional            | Balanced                    | step flow, resumo, inputs, status                                    | múltiplas surfaces e risco de CTA concorrente; não alterar confirmação financeira                                                            | crítico | P2 com owner Stripe/Agenda |
| `/cliente/login`, `/cliente/cadastro`, `/terapeuta/login`, `/terapeuta/cadastro` | visitante; autenticar/cadastrar                     | formulário              | Comfortable                 | auth panel, inputs, feedback                                         | experiências paralelas podem divergir em spacing, erro e supporting copy                                                                     | alto    | P2                         |
| `/app`                                                                           | Paciente; orientar próximo cuidado                  | orientação/retorno      | Balanced                    | hero pessoal, encontro, favoritos, check-in                          | muitos módulos em cards; identidade humana depende de decoração e não só de hierarquia                                                       | alto    | P1 depois dos benchmarks   |
| `/app/encontros`                                                                 | Paciente; entender próximos e passados              | lista/ação              | Balanced                    | hero, metric cards, listas, empty states                             | KPIs precedem tarefas em alguns estados; oportunidade de humanização com clareza transacional                                                | alto    | **Benchmark C**            |
| `/app/encontros/:id` e vídeo                                                     | Paciente; preparar/entrar/acompanhar encontro       | detalhe crítico         | Balanced                    | summary, timeline/status, actions, dialog                            | alta sensibilidade de estado; qualquer redesign pode esconder elegibilidade Zoom/pagamento                                                   | crítico | P2 com owner Zoom          |
| `/app/favoritos*`                                                                | Paciente; retomar escolhas                          | coleção                 | Balanced                    | tabs, therapist/therapy cards, empty                                 | duplicação de cards públicos e tendência a grids equivalentes                                                                                | médio   | P3                         |
| `/app/mensagens`                                                                 | Paciente; conversar e pedir suporte                 | comunicação             | Operational/Balanced        | thread list, conversation, composer                                  | layout de duas colunas exige transformação mobile; componente local forte                                                                    | alto    | P2                         |
| `/terapeuta`                                                                     | Terapeuta; decidir o foco operacional do dia        | dashboard               | Balanced                    | welcome hero, stats, sessões, avaliações, charts                     | dashboard composto por cards e KPIs; first fold pode priorizar saudação sobre tarefa                                                         | alto    | P1 após calibração         |
| `/terapeuta/agenda`                                                              | Terapeuta; organizar disponibilidade e compromissos | calendário/planejamento | Operational + rail Balanced | PageHeader, segmented nav, command/filter bar, timeline, ContextRail | referência e código usam muitos limites; componente monolítico; risco de microtexto e scroll interno; range dinâmico recente é avanço        | crítico | **Benchmark A**            |
| `/terapeuta/sessoes*`                                                            | Terapeuta; operar sessões e detalhe                 | tabela/lista/detalhe    | Operational                 | KPI cards, FilterBar local, tabela, mobile cards, StatusBadge        | métricas em cards e múltiplos status; componente de página muito extenso                                                                     | crítico | P1 após Agenda             |
| `/terapeuta/pacientes*`                                                          | Terapeuta; acompanhar jornada permitida             | lista/detalhe           | Balanced/Operational        | filtros, EntityList, detail sections                                 | risco de cardification e de mostrar dado sensível; domínio precisa continuar soberano                                                        | crítico | P2                         |
| `/terapeuta/financeiro`                                                          | Terapeuta; reconciliar recebimentos e repasses      | finanças/comparação     | Operational                 | tabs, metric cards, tabelas, status                                  | hotspot de borders; projeção/realizado/contratado precisam hierarquia inequívoca                                                             | crítico | P2 com owner financeiro    |
| `/terapeuta/servicos*`                                                           | Terapeuta; configurar ofertas                       | CRUD/form               | Balanced                    | cards, dialogs, forms, badges                                        | muitos componentes locais e surfaces; online-only precisa permanecer explícito                                                               | alto    | P2                         |
| `/terapeuta/perfil*`                                                             | Terapeuta; publicar e visualizar perfil             | preview/editor          | Balanced                    | preview, forms, sticky save, cards                                   | `AppPageSection` gera card em todas as seções; editor pode ficar fragmentado                                                                 | crítico | P2                         |
| `/terapeuta/insights`, `/terapeuta/avaliacoes`                                   | Terapeuta; interpretar sinais permitidos            | analítico               | Balanced/Operational        | MetricStrip informal, charts, reviews, gates de plano                | risco de dashboard genérico e linguagem de performance; amostra mínima é eliminatória                                                        | crítico | P2                         |
| `/terapeuta/plano`, `/configuracoes`, `/suporte`, `/mensagens`                   | Terapeuta; gerir conta e relacionamento             | config/comunicação      | Balanced                    | sections, forms, cards, dialogs                                      | inconsistência entre headers/sections e actions; rotas são estáveis                                                                          | alto    | P3                         |
| `/admin`                                                                         | Admin; detectar prioridade operacional              | dashboard               | Operational                 | hero grande, KPI cards, charts, alerts                               | display muito grande e KPIs dominantes reduzem throughput; forte aparência SaaS                                                              | alto    | P1 após benchmarks         |
| `/admin/profissionais*`                                                          | Admin; pesquisar, verificar e agir                  | tabela/detalhe          | Operational                 | métricas, filters, table, status pills, detail panels                | tabela mínima de 1080px, duplicação de status e muitas surfaces; melhor teste de densidade                                                   | crítico | **Benchmark B**            |
| `/admin/pacientes*`, `/admin/sessoes*`                                           | Admin; investigar entidades e exceções              | tabela/detalhe          | Operational                 | operação genérica, filtros, tables/cards mobile                      | abstração compartilhada existe, mas pages especializadas também duplicam composição                                                          | crítico | P1 após benchmark          |
| `/admin/pagamentos*`, `/admin/assinaturas*`                                      | Admin; reconciliar operação financeira              | tabela/detalhe          | Operational                 | metrics, status, tables, rails                                       | alta densidade e risco de semântica financeira diluída por badges/cards                                                                      | crítico | P2 com owner financeiro    |
| `/admin/avaliacoes*`, `/admin/suporte*`, `/admin/terapias`                       | Admin; moderar e resolver filas                     | fila/tabela/detalhe     | Operational                 | filters, list/table, status, actions                                 | affordances e status variam entre features equivalentes                                                                                      | alto    | P2                         |
| `/admin/matching`, `/integracoes`, `/seguranca`, `/relatorios`, `/configuracoes` | Admin; governar plataforma                          | análise/configuração    | Operational                 | dashboards, forms, sections                                          | maturidade desigual; parte das superfícies ainda é genérica ou placeholder funcional                                                         | alto    | P3                         |

## Auditoria de componentes

### Existentes e classificação

| Elemento                           | Local                                 | Classe                          | Achado                                                                         | Direção                                                                        |
| ---------------------------------- | ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `TESButton`                        | `src/components/tes`                  | primitive                       | variantes úteis; pill/gradiente podem ser usados por convenção                 | preservar e testar hierarquia/estados antes de expandir                        |
| `TESInput`                         | `src/components/tes`                  | primitive                       | contrato consistente, mas altura/surface fixa reduz flexibilidade de densidade | avaliar variantes após benchmarks, não criar input paralelo                    |
| `TESBadge`                         | `src/components/tes`                  | primitive                       | bom token semântico; uso indiscriminado continua possível                      | limitar a estados escaneáveis e criar contrato de StatusCluster                |
| `TESCard`                          | `src/components/tes`                  | primitive/surface               | sempre aplica border, radius e shadow                                          | não remover agora; avaliar surface variants após calibração                    |
| `TESDialog`                        | `src/components/tes`                  | primitive/pattern               | portal, overlay, scroll lock, foco, Escape e retorno de foco robustos          | autoridade modal; migrar o dialog local de disponibilidade futuramente         |
| `FilterButton`                     | `src/components/tes`                  | primitive                       | específico em aparência, potencialmente reutilizável                           | validar junto de FilterBar antes de promover API                               |
| `TherapistCard`                    | `src/components/tes`                  | domain                          | reutiliza TES primitives, mas concentra badges e CTAs                          | preservar domínio; revisar variantes por contexto após benchmark público       |
| `JourneyBanner`                    | `src/components/tes`                  | domain/pattern                  | banner de jornada com identidade própria                                       | manter domínio enquanto não houver repetição transversal                       |
| `PublicHeader/Footer/AuthMenu`     | `src/components/tes`                  | pattern/domain                  | navegação compartilhada real                                                   | preservar e auditar responsividade/estados isoladamente                        |
| `AppPageContainer/Grid/Main/Aside` | `src/components/app-page`             | pattern/layout                  | grid compartilhado valioso                                                     | preservar; pode sustentar densidades por variante futuramente                  |
| `AppPageHeader/Section`            | `src/components/app-page`             | pattern                         | sempre card/border/shadow                                                      | principal dívida sistêmica; criar variantes só após benchmarks                 |
| `AppStickySaveBar`                 | `src/components/app-page`             | pattern                         | função clara de persistência                                                   | preservar; verificar mobile, foco e overlap                                    |
| `StatusBadge/Pill` locais          | Admin, Sessões e outras features      | primitive/domain                | múltiplas implementações funcionalmente equivalentes                           | inventariar sem substituir em massa; convergir semântica primeiro              |
| `MetricCard/KPI` locais            | dashboards/finance/operations         | page-specific/pattern candidato | repetição alta e APIs guiadas por layout                                       | não criar MegaMetricCard; validar `MetricStrip` nos benchmarks                 |
| Filters locais                     | Agenda, Sessões, Admin, busca pública | pattern candidato               | mesma intenção, anatomias e URL contracts diferentes                           | documentar `FilterBar`; implementação compartilhada só após 3 casos calibrados |
| Tables locais                      | Admin, Financeiro, Sessões            | pattern/domain                  | markup e mobile variam                                                         | definir OperationalTable; evitar abstração que esconda colunas/domínio         |
| Empty/error states locais          | várias features                       | pattern candidato               | copy e distinção de estados variam                                             | padronizar anatomia e semântica antes do componente                            |
| availability modal local           | `therapist-profile`                   | page-specific                   | usa `role=dialog` diretamente, contrário à regra atual                         | dívida registrada; migrar para `TESDialog` em tarefa própria                   |

### Componentes globais ainda inexistentes

Há evidência conceitual para PageHeader com densidade, SectionHeader,
ActionCluster, FilterBar, MetricStrip, ContextRail, OperationalTable, EntityList,
EmptyState e SegmentedNavigation. Isso não é evidência suficiente para implementar
todos agora: APIs prematuras apenas centralizariam decisões visuais ainda não
calibradas. Os três benchmarks devem revelar variantes reais.

## Agenda como primeira experiência de redesign

### Preservar

- contratos e dados reais de calendário, bookings, holds, blocks e schedule;
- range temporal derivado de regras/eventos, incluindo madrugada;
- filtros antes da agenda, abertos no desktop e recolhidos no mobile;
- transformação da grade em lista cronológica mobile;
- uso de `TESDialog`, tokens TES, copy correta e QA Playwright visível;
- mínimo de `11px` desktop e `10px` mobile apenas para metadata.

### Generalizar

- faixa operacional derivada do dado, não de um horário fixo;
- disclosure responsivo de filtros;
- checklist de alinhamento/padding do primeiro item;
- validação em desktop/tablet/mobile e política tipográfica automatizada;
- separação entre intenção visual, implementação e crítica.

### Corrigir no benchmark

- mover regras visuais universais da skill de domínio para as duas skills globais;
- decompor o calendário monolítico somente quando a anatomia estiver validada;
- reduzir card/border/shadow sem prejudicar comparação temporal;
- definir all-day/overnight e scroll interno com affordance clara;
- avaliar falha parcial de schedule sem produzir sucesso aparente;
- distinguir padrões reutilizáveis de decisões exclusivas da Agenda.

## Divergências registradas

| Fonte               | Divergência                                   | Decisão nesta fundação                                                                |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| docs históricos     | afirmam que componentes TES React não existem | código atual já possui primitives e patterns; docs novas usam estado real             |
| design-system.md    | Figma é descrito como fonte visual final      | Figma continua referência, abaixo de produto, experiência e Design System             |
| docs/implementation | exemplos com Básico/Pro/Plus                  | novas autoridades usam Free/Premium/Premium Plus; não houve migração documental ampla |
| visual-policy.md    | bloqueava `10px` inclusive no mobile          | corrigido para `10px` mobile e `11px` desktop, somente metadata                       |
| Figma Agenda        | microtexto e muitos containers visuais        | copy e estrutura orientam; problemas não são copiados cegamente                       |
| `AppPage*`          | header/section sempre cardificados            | dívida reconhecida; sem refactor massivo nesta etapa                                  |
| Storybook docs      | planos sugerem instalação                     | package e árvore confirmam ausência; decisão atual é introduzir depois da calibração  |
| rotas/docs          | referências históricas e aliases coexistem    | `src/lib/routes.ts` permanece autoridade; nenhuma rota foi alterada                   |

## Riscos

- O volume de documentação antiga pode continuar levando agentes a regras
  desatualizadas se não seguirem a ordem de autoridade do `AGENTS.md`.
- Sem calibrar benchmarks, criar variants de `AppPageSection` ou um FilterBar
  global pode apenas institucionalizar a aparência atual.
- Testes estáticos contam sinais, não função semântica; cada refactor precisa de
  inspeção visual e de domínio.
- Algumas páginas têm contratos críticos de Stripe, Zoom, RLS e privacidade;
  Visual Director não pode alterar sua semântica.
- A disponibilidade modal local permanece divergente do contrato `TESDialog`.
- Fallbacks locais documentados em páginas públicas precisam de auditoria própria
  frente à regra atual de não ocultar falhas.
