# Inventário de páginas e roadmap visual pós-Calibration

Status: planejamento — nenhuma página é alterada por este documento  
Atualização: 2026-08-14  
Fontes: `src/app`, `src/lib/routes.ts`, `next.config.mjs`, skills de domínio,
`docs/product/{sitemap,routes-map,page-inventory}.md`, benchmarks A/B/C e
`calibration-contract.md`.

Este é o inventário para planejamento visual. O inventário de domínio em
`docs/product/page-inventory.md` permanece a referência de conteúdo e estados;
quando há divergência, a árvore real do App Router prevalece para dizer se uma
rota é uma página existente hoje.

## Método e legenda

- **Paciente/Cliente** inclui descoberta pública, reserva, autenticação e shell
  do paciente: são uma única jornada de aquisição à continuidade.
- **Ativa** significa que existe página real no App Router; aliases, redirects,
  shells e wrappers técnicos ficam em seção própria.
- `CALIBRATED` tem evidência de benchmark pós-Calibration; `PARTIAL` possui
  base útil, mas não passou pelo workflow completo; `LEGACY` ainda depende da
  composição anterior; `CRITICAL` tem limitação operacional ou de experiência
  que impede tratá-la como pronta para rollout visual.
- A avaliação é preliminar de código, skills e evidências dos benchmarks. Só
  os três benchmarks receberam Visual QA completo em navegador.

## Paciente / Cliente

|   # | Página                                  | Rota                                    | Tarefa dominante          | Estado visual | Patterns prováveis                                                        | Prioridade   | Observações                                                                   |
| --: | --------------------------------------- | --------------------------------------- | ------------------------- | ------------- | ------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
|   1 | Home                                    | `/`                                     | descoberta                | PARTIAL       | composição editorial, seção aberta, CTA contextual                        | Média        | Entrada pública; ainda repete `TESCard`.                                      |
|   2 | Sobre nós                               | `/sobre-nos`                            | orientação                | PARTIAL       | PageHeader open, seção aberta                                             | Baixa        | Institucional simples.                                                        |
|   3 | Sua jornada                             | `/sua-jornada`                          | orientação                | PARTIAL       | PageHeader open, seleção, CTA contextual                                  | Média        | Match anônimo e determinístico.                                               |
|   4 | Resultado da jornada                    | `/sua-jornada/resultado`                | orientação                | PARTIAL       | AccentSemanticSurface, EntityList balanced, CTA contextual                | Média-alta   | Cards de caminhos ainda concorrem.                                            |
|   5 | Terapias                                | `/terapias`                             | descoberta                | PARTIAL       | FilterBar, grid editorial ou EntityList, CTA contextual                   | Média-alta   | Catálogo público com busca e filtros.                                         |
|   6 | Detalhe da terapia                      | `/terapias/[slug]`                      | detalhe                   | PARTIAL       | PageHeader open, seções abertas, entidades relacionadas                   | Média-alta   | Educação e continuação para profissionais.                                    |
|   7 | Busca de terapeutas                     | `/terapeutas`                           | descoberta                | LEGACY        | FilterBar, EntityList balanced/mobile, PageHeader balanced                | Alta         | Busca de alta intenção, hoje card/filter-heavy.                               |
|   8 | Perfil público do terapeuta             | `/terapeutas/[slug]`                    | detalhe/decisão           | PARTIAL       | PageHeader open, AccentSemanticSurface, CTA contextual                    | Alta         | Ponto de confiança antes da reserva.                                          |
|   9 | Reserva                                 | `/reserva`                              | aquisição/transação       | PARTIAL       | PageHeader balanced, status guidance, CTA contextual, seções leves        | Alta         | Fluxo crítico; não alterar pagamento/hold para refatorar.                     |
|  10 | Reserva confirmada                      | `/reserva/sucesso`                      | orientação pós-ação       | PARTIAL       | AccentSemanticSurface, CTA contextual                                     | Média        | Aguarda confirmação financeira autoritativa.                                  |
|  11 | Login cliente                           | `/cliente/login`                        | autenticação              | PARTIAL       | auth shell, CTA contextual                                                | Média        | Fluxo real do cliente.                                                        |
|  12 | Cadastro cliente                        | `/cliente/cadastro`                     | aquisição                 | PARTIAL       | auth shell, seção leve, CTA contextual                                    | Média        | Fluxo real do cliente.                                                        |
|  13 | Confirmar e-mail                        | `/confirmar-email`                      | pós-ação                  | PARTIAL       | status guidance                                                           | Baixa-média  | Compartilhada por fluxos de autenticação.                                     |
|  14 | Redefinir senha                         | `/reset-senha`                          | pós-ação                  | PARTIAL       | status guidance                                                           | Baixa-média  | Compartilhada por fluxos de autenticação.                                     |
|  15 | Ajuda pública                           | `/ajuda`                                | orientação                | PARTIAL       | PublicInfoLayout, seção leve                                              | Baixa        | Pode permanecer indisponível até liberação jurídica/operacional.              |
|  16 | Termos                                  | `/termos`                               | informação jurídica       | LEGACY        | PublicInfoLayout                                                          | Baixa        | Superfície institucional.                                                     |
|  17 | Privacidade                             | `/privacidade`                          | informação jurídica       | LEGACY        | PublicInfoLayout                                                          | Baixa        | Superfície institucional.                                                     |
|  18 | Cancelamento, reagendamento e reembolso | `/cancelamento-reagendamento-reembolso` | informação jurídica       | LEGACY        | PublicInfoLayout                                                          | Baixa        | Publicação condicionada à versão jurídica aprovada.                           |
|  19 | Início do paciente                      | `/app`                                  | acompanhamento/orientação | LEGACY        | PageHeader balanced, Light PageSection, EntityList leve, CTA contextual   | Alta         | Entrada autenticada e recorrente; composição de dashboard ainda domina.       |
|  20 | Encontros                               | `/app/encontros`                        | temporal                  | CALIBRATED    | PageHeader balanced, EntityList temporal, status guidance, CTA contextual | Referência   | Benchmark C; não refatorar automaticamente.                                   |
|  21 | Detalhe do encontro                     | `/app/encontros/[bookingId]`            | detalhe/transação         | PARTIAL       | EntitySummary, seção leve, status guidance, CTA contextual                | Alta         | Muitos blocos empilhados, adjacente ao benchmark C.                           |
|  22 | Videochamada                            | `/app/encontros/[bookingId]/video`      | sessão                    | CRITICAL      | composição imersiva local, status guidance, CTA contextual                | Condicionada | Depende da homologação Zoom/HML e QA móvel, não de redesign isolado.          |
|  23 | Terapeutas favoritos                    | `/app/favoritos/terapeutas`             | acompanhamento            | LEGACY        | EntityList balanced/mobile, seção leve, CTA contextual                    | Média-alta   | Header em card, grid por terapeuta e badges ainda dominam.                    |
|  24 | Terapias favoritas                      | `/app/favoritos/terapias`               | acompanhamento            | PARTIAL       | EmptyState, CTA contextual                                                | Baixa        | Estado honesto: a fonte canônica ainda não foi implementada.                  |
|  25 | Mensagens e suporte                     | `/app/mensagens`                        | comunicação               | LEGACY        | PageHeader balanced, EntityList, Status Anatomy, TESDialog                | Alta         | Canal canônico de suporte do paciente; hero e containers são pré-Calibration. |

### Paciente: não contar como páginas reais

- **Aliases/redirects:** `/paciente/inicio` reexporta `/app`; `/app/favoritos`
  redireciona para favoritos de terapeutas; `/app/sessoes`,
  `/app/sessoes/[bookingId]`, `/app/sessoes/proximas` e
  `/app/sessoes/historico` redirecionam ao namespace canônico de encontros.
- **Declaradas, mas sem página:** `/app/pagamentos`,
  `/app/pagamentos/faturas`, `/app/pagamentos/metodos`,
  `/app/configuracoes` e suas subrotas constam em rotas/docs, mas não possuem
  `page.tsx`. Também não existe `/app/ajuda`: o suporte canônico é Mensagens.
- **Dívida de rota:** `receipt_url` do detalhe pode apontar para
  `/app/pagamentos/comprovantes/:bookingId`, rota não encontrada no App Router.

## Terapeuta

|   # | Página              | Rota                                   | Tarefa dominante      | Estado visual | Patterns prováveis                                                                     | Prioridade   | Observações                                                          |
| --: | ------------------- | -------------------------------------- | --------------------- | ------------- | -------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
|   1 | Para terapeutas     | `/para-terapeutas`                     | aquisição             | PARTIAL       | composição editorial, CTA contextual                                                   | Média        | Entrada pública de planos.                                           |
|   2 | Login terapeuta     | `/terapeuta/login`                     | autenticação          | PARTIAL       | auth shell, CTA contextual                                                             | Média        | Entrada do shell profissional.                                       |
|   3 | Cadastro terapeuta  | `/terapeuta/cadastro`                  | aquisição             | PARTIAL       | auth shell, seção leve, CTA contextual                                                 | Média        | Onboarding por plano.                                                |
|   4 | Checkout de plano   | `/terapeuta/checkout`                  | aquisição/transação   | PARTIAL       | status guidance, CTA contextual                                                        | Média        | Stripe continua autoridade por webhook.                              |
|   5 | Início              | `/terapeuta`                           | orientação/operação   | PARTIAL       | PageHeader balanced, seção leve, CTA contextual                                        | Alta         | Mistura checklist e dashboard, ainda card-heavy.                     |
|   6 | Agenda              | `/terapeuta/agenda`                    | temporal/operação     | CALIBRATED    | PageHeader open, CommandBar, FilterBar, Timeline, ContextRail                          | Referência   | Benchmark A; solução temporal específica, não template.              |
|   7 | Sessões             | `/terapeuta/sessoes`                   | operação              | LEGACY        | OperationalTable, FilterBar, Status Anatomy                                            | Alta         | Superfície central densa, ainda fora da linguagem calibrada.         |
|   8 | Detalhe da sessão   | `/terapeuta/sessoes/[bookingId]`       | detalhe/operação      | LEGACY        | EntitySummary, StatusCluster, CTA contextual                                           | Alta         | Deve preservar Zoom, pagamento, reagendamento e cancelamento.        |
|   9 | Videochamada        | `/terapeuta/sessoes/[bookingId]/video` | sessão                | CRITICAL      | composição imersiva local, status guidance                                             | Condicionada | Mesmo gate Zoom/HML do paciente.                                     |
|  10 | Pacientes           | `/terapeuta/pacientes`                 | acompanhamento        | PARTIAL       | EntityList operacional, FilterBar, Status Anatomy                                      | Média        | Capability-gated, dados reais.                                       |
|  11 | Jornada do paciente | `/terapeuta/pacientes/[patientId]`     | detalhe               | PARTIAL       | EntitySummary, Timeline, StatusCluster                                                 | Média        | Premium Plus, menor frequência.                                      |
|  12 | Mensagens           | `/terapeuta/mensagens`                 | comunicação           | LEGACY        | EntityList, TESDialog, Status Anatomy                                                  | Média        | Compartilha o Message Center pré-Calibration.                        |
|  13 | Suas terapias       | `/terapeuta/servicos`                  | configuração/operação | PARTIAL       | PageHeader balanced, EntityList, TESDialog, CTA contextual                             | Alta         | Função real, mas ainda baseada em `TESCard`.                         |
|  14 | Financeiro          | `/terapeuta/financeiro`                | financeiro            | LEGACY        | FilterBar, StatusCluster, MetricStrip local, OperationalTable                          | Alta         | Alta densidade e risco; refactor só com owner financeiro.            |
|  15 | Avaliações          | `/terapeuta/avaliacoes`                | acompanhamento        | PARTIAL       | PageHeader balanced, EntityList, Status Anatomy                                        | Média        | Real e ainda card-heavy.                                             |
|  16 | Métricas e insights | `/terapeuta/insights`                  | análise               | PARTIAL       | Hero editorial, MetricStrip local, série SVG acessível, StatusCluster e rail analítico | Média        | Refatorada em 17/08/2026; falta validação visual nos viewports.      |
|  17 | Assessora Aura     | `/terapeuta/assessor-ia`               | orientação            | PARTIAL       | AccentSemanticSurface, CTA contextual                                                  | Média        | Não passou por calibração própria.                                   |
|  18 | Meu perfil          | `/terapeuta/perfil`                    | preview               | PARTIAL       | EntitySummary, seção leve, CTA contextual                                              | Média        | Preview-first funcional.                                             |
|  19 | Editar perfil       | `/terapeuta/perfil/editar`             | configuração          | PARTIAL       | PageHeader balanced, seção leve, AppStickySaveBar                                      | Média        | Base funcional boa, visual intermediário.                            |
|  20 | Meu plano           | `/terapeuta/plano`                     | assinatura            | PARTIAL       | Hero editorial, resumo do plano, CTA contextual e comparação agrupada                  | Média        | Refatorado em 17/08/2026; falta validação visual nos três viewports. |
|  21 | Configurações       | `/terapeuta/configuracoes`             | configuração          | LEGACY        | PageHeader legacy, seção leve, StatusCluster                                           | Alta         | Muitas sections framed e defaults anteriores.                        |

### Terapeuta: não contar como páginas reais

- `/terapeuta/metricas` redireciona para Insights e não está em
  `src/lib/routes.ts`; `/terapeuta/servicos/meus` redireciona para Serviços.
- `/terapeuta/[slug]` redireciona ao perfil público canônico;
  `/basico/*`, `/pro/*` e `/plus/*` são aliases compatíveis para
  `/terapeuta/*`.

## Admin

|   # | Página                 | Rota                                                 | Tarefa dominante      | Estado visual | Patterns prováveis                                                            | Prioridade  | Observações                                              |
| --: | ---------------------- | ---------------------------------------------------- | --------------------- | ------------- | ----------------------------------------------------------------------------- | ----------- | -------------------------------------------------------- |
|   1 | Login Admin            | `/admin-login`                                       | autenticação          | PARTIAL       | AccentSemanticSurface, CTA contextual                                         | Média       | `/admin/login` é alias técnico.                          |
|   2 | Visão geral            | `/admin`                                             | operação por exceção  | LEGACY        | PageHeader compact-operational, EntityList, MetricStrip local                 | Alta        | KPI/cards e sombras dominam a primeira dobra.            |
|   3 | Profissionais          | `/admin/profissionais`                               | triagem               | CALIBRATED    | Header compact-operational, FilterBar, EntityList operacional, Status Anatomy | Referência  | Benchmark B.                                             |
|   4 | Detalhe profissional   | `/admin/profissionais/[professionalId]`              | detalhe/decisão       | PARTIAL       | EntitySummary, Status Anatomy, CTA contextual                                 | Média-alta  | Família nova de detalhes, sem benchmark próprio.         |
|   5 | Verificações           | `/admin/profissionais/verificacoes`                  | operação por exceção  | PARTIAL       | FilterBar operacional, EntityList, Status Anatomy                             | Alta        | Badge/card-heavy no mobile.                              |
|   6 | Detalhe da verificação | `/admin/profissionais/verificacoes/[verificationId]` | decisão               | PARTIAL       | EntitySummary, status guidance, CTA contextual                                | Média       | Rota dedicada.                                           |
|   7 | Clientes               | `/admin/pacientes`                                   | operação por exceção  | PARTIAL       | FilterBar, EntityList operacional, Status Anatomy                             | Alta        | Estrutura dedicada, porém ainda analítica/card-heavy.    |
|   8 | Detalhe cliente        | `/admin/pacientes/[patientId]`                       | detalhe               | PARTIAL       | EntitySummary, seções de detalhe                                              | Média       | Nova gramática de detalhe, não calibrada.                |
|   9 | Sessões                | `/admin/sessoes`                                     | operação              | PARTIAL       | FilterBar, OperationalTable/EntityList, Status Anatomy                        | Alta        | Boa base estrutural e alta sinergia com Profissionais.   |
|  10 | Detalhe sessão         | `/admin/sessoes/[sessionId]`                         | detalhe               | PARTIAL       | EntitySummary, seções de detalhe, CTA contextual                              | Média-alta  | Caso seguro da sessão.                                   |
|  11 | Suporte                | `/admin/suporte`                                     | operação              | PARTIAL       | FilterBar, EntityList operacional, Status Anatomy                             | Média-alta  | Compartilha base de Sessões.                             |
|  12 | Detalhe suporte        | `/admin/suporte/[ticketId]`                          | detalhe               | PARTIAL       | EntitySummary, CTA contextual                                                 | Média       | Rota dedicada.                                           |
|  13 | Avaliações             | `/admin/avaliacoes`                                  | moderação             | LEGACY        | FilterBar, EntityList, Status Anatomy                                         | Alta        | Ainda no wrapper operacional genérico.                   |
|  14 | Detalhe avaliação      | `/admin/avaliacoes/[reviewId]`                       | detalhe/moderação     | LEGACY        | status guidance, seções de detalhe                                            | Alta        | Detalhe genérico legado.                                 |
|  15 | Pagamentos             | `/admin/pagamentos`                                  | financeiro            | PARTIAL       | FilterBar, OperationalTable, Status Anatomy                                   | Alta        | Densa, crítica e dedicada; ainda sem benchmark.          |
|  16 | Detalhe pagamento      | `/admin/pagamentos/[paymentId]`                      | detalhe financeiro    | PARTIAL       | EntitySummary, seções de detalhe                                              | Média       | Boa base para detalhe financeiro.                        |
|  17 | Assinaturas            | `/admin/assinaturas`                                 | financeiro            | PARTIAL       | FilterBar, EntityList/Table, Status Anatomy                                   | Média-alta  | Dedicada, mais nova que o legado.                        |
|  18 | Detalhe assinatura     | `/admin/assinaturas/[subscriptionId]`                | detalhe financeiro    | LEGACY        | Status Anatomy, seções de detalhe                                             | Média-alta  | Ainda usa detalhe financeiro genérico.                   |
|  19 | Terapias               | `/admin/terapias`                                    | catálogo/configuração | PARTIAL       | PageHeader open, AccentSemanticSurface, CTA contextual                        | Média-alta  | Rica funcionalmente; cards por item e mutações in-place. |
|  20 | Matching               | `/admin/matching`                                    | configuração          | PARTIAL       | PageHeader open, AccentSemanticSurface, dialogs locais                        | Média-alta  | Rota de erro ainda mostra Request ID no front-end.       |
|  21 | Integrações            | `/admin/integracoes`                                 | governança            | LEGACY        | Light PageSection, Status Anatomy                                             | Média       | Rota ativa, escondida no menu.                           |
|  22 | Segurança              | `/admin/seguranca`                                   | governança            | LEGACY        | Light PageSection, Status Anatomy, EntityList                                 | Média       | `AppPage*` legado.                                       |
|  23 | Relatórios             | `/admin/relatorios`                                  | análise/exportação    | LEGACY        | FilterBar, EntityList                                                         | Média-baixa | Rota escondida e baseada no módulo financeiro genérico.  |
|  24 | Configurações          | `/admin/configuracoes`                               | governança            | PARTIAL       | PageHeader compact, seção leve, Status Anatomy                                | Média       | Mais recente, mas ainda framed/card-heavy.               |

### Admin: não contar como páginas reais

- Shells, wrappers de operação/finanças e ações server-side são infraestrutura,
  não páginas de produto.
- `/admin/login` é alias para `/admin-login`.
- Integrações e Relatórios existem, mas estão marcadas como `hidden` na
  navegação administrativa.

## Saúde visual aproximada

Escopo: 71 páginas de produto ativas nas três tabelas, incluindo aquisição
pública específica por persona e excluindo aliases/redirects/rotas declaradas
sem arquivo.

| CALIBRATED | PARTIAL | LEGACY | CRITICAL |
| ---------: | ------: | -----: | -------: |
|          3 |      45 |     20 |        3 |

Os três itens calibrados são Agenda, Profissionais e Encontros. `CRITICAL` fica
restrito a problemas objetivos já conhecidos: as duas salas Zoom, dependentes
de homologação HML e QA móvel, e a página de suporte do terapeuta ainda em
construção. Densidade alta ou aparência antiga, sem reprodução em navegador,
fica em `LEGACY`/`PARTIAL`, não em `CRITICAL`.

## Famílias de páginas

- **Paciente/Cliente:** descoberta e Match; busca e confiança; reserva e
  pós-ação; continuidade (início, encontros, favoritos); comunicação e suporte;
  autenticação; jurídico. Pagamentos e configurações permanecem contratos sem
  página implementada.
- **Terapeuta:** aquisição/onboarding; orientação; agenda e sessões; pacientes;
  oferta e perfil; financeiro e inteligência; comunicação; assinatura e
  configurações. `/terapeuta/suporte` e aliases antigos redirecionam para
  Mensagens e não contam como página própria.
- **Admin:** visão geral; pessoas e verificações; operação diária (sessões,
  suporte e avaliações); financeiro; catálogo e Matching; governança.

## Roadmap Paciente/Cliente

`P00` é referência, não execução: **`/app/encontros`** permanece como baseline
Balanced do Benchmark C.

| Ordem | Página/família                                                | Referência visual    | Motivo                                                                                                                                     |
| ----- | ------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P01   | `/app`                                                        | REFERENCE HIGH VALUE | É a entrada autenticada frequente e ainda parece dashboard de cards, devendo estabilizar orientação Balanced sem tocar contratos críticos. |
| P02   | `/app/encontros/[bookingId]`                                  | REFERENCE HIGH VALUE | Fecha o fluxo do benchmark C com hierarquia temporal, status orientador e CTA autorizado ainda dispersos em blocos.                        |
| P03   | `/app/mensagens`                                              | REFERENCE OPTIONAL   | É comunicação e suporte canônicos, frequentes e cross-role, hoje com hero e surfaces legados.                                              |
| P04   | `/app/favoritos/terapeutas`                                   | REFERENCE OPTIONAL   | Permite consolidar EntityList Balanced/mobile em coleção humana sem a complexidade financeira ou Zoom.                                     |
| P05   | `/reserva`                                                    | REFERENCE HIGH VALUE | É a etapa transacional crítica, extensa e containerizada; entra depois que ações contextuais e seções Balanced estiverem estáveis.         |
| P06   | `/terapeutas`                                                 | REFERENCE HIGH VALUE | Busca e filtros de alta intenção podem reutilizar padrões amadurecidos sem comprimir o desktop no mobile.                                  |
| P07   | `/terapeutas/[slug]`                                          | REFERENCE HIGH VALUE | É a decisão de confiança imediatamente anterior à reserva e exige composição editorial específica.                                         |
| P08   | `/terapias` e `/terapias/[slug]`                              | REFERENCE OPTIONAL   | Refinam a descoberta editorial e a continuidade para profissionais, sem bloquear o fluxo autenticado.                                      |
| P09   | `/sua-jornada` e `/sua-jornada/resultado`                     | REFERENCE HIGH VALUE | O Match tem identidade própria e pede refinamento de orientação, não uma cópia de listas operacionais.                                     |
| P10   | Login, cadastro, confirmar e-mail, reset e `/reserva/sucesso` | REFERENCE OPTIONAL   | É uma família de estados de acesso/pós-ação com baixo risco de domínio e consistência direta de copy e feedback.                           |
| P11   | Ajuda e jurídico público                                      | REFERENCE LOW VALUE  | São superfícies estruturalmente simples e de baixa frequência; a Calibration já dá direção suficiente.                                     |
| P12   | `/app/encontros/[bookingId]/video`                            | REFERENCE LOW VALUE  | Só entra após `ZOOM HML E2E: PASS`; a limitação atual é operacional e responsiva, não ausência de referência.                              |

Fora do roadmap visual: `/app/favoritos/terapias` necessita fonte canônica;
`/app/pagamentos*`, `/app/configuracoes*` e o destino de comprovante exigem
decisão/implementação funcional antes de receberem refatoração visual.

## Primeira recomendação

**Começar por `/app`.** É a página autenticada de maior frequência no Paciente,
tem forte desalinhamento com a gramática Balanced e pode aplicar `PageHeader
balanced`, `Light PageSection`, `AccentSemanticSurface`, `ContextualCTA`,
`Status Anatomy` e `EntityList leve` sem replicar a Agenda nem modificar
pagamento, Zoom, booking ou permissões. Uma referência externa tem alto valor
para orientar a composição humana/editorial dessa primeira dobra.

## Riscos e incógnitas

- O launcher atual não expõe `product_ux`, `visual_director` e
  `design_system_guardian` como papéis executáveis, embora o manifesto do
  projeto os declare; antes de uma refatoração, confirmar o carregamento do
  `.codex/config.toml` sem criar configuração duplicada.
- O diagnóstico do Codex encontrou indisponibilidade opcional do MCP Supabase
  local e falha de reachability externa; isso não invalida a leitura de código,
  mas deve ser resolvido antes de QA integrado/HML.
- A classificação visual fora dos benchmarks não substitui Playwright visível
  em desktop, tablet e mobile.
- `TESBadge` usa `0.68rem` (aprox. 10,9px), abaixo do piso desktop de 11px;
  páginas badge-heavy não podem ser consideradas visualmente saudáveis até que
  essa dívida transversal seja tratada em escopo próprio.
- `AppPageHeader`, `AppPageSection` e `TESCard` ainda aplicam card/borda/sombra
  por default. Isso é compatibilidade legada, não evidência de composição
  calibrada.
- Existem divergências reais entre contratos de rotas e o App Router do
  paciente, além de rotas de vídeo dependentes da homologação Zoom.

`PAGE INVENTORY READY`
