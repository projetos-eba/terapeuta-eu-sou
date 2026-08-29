---
name: therapist-agenda-sessions
description: Implementar e manter Agenda, disponibilidade, bookings e Sessões do terapeuta usando rotas, contratos e fontes transacionais compartilhadas.
---

# Agenda e Sessões do terapeuta

## Fontes obrigatórias

1. `AGENTS.md`.
2. Figma da página específica, quando disponível.
3. `docs/architecture/adr/ADR-001-therapist-canonical-routes.md`.
4. `docs/architecture/adr/ADR-002-booking-session-boundary.md`.
5. `docs/architecture/adr/ADR-003-session-payments-source-of-truth.md`.
6. `docs/architecture/adr/ADR-004-meeting-security.md`.
7. `docs/architecture/adr/ADR-005-availability-authority.md`.
8. `docs/architecture/therapist-domain-vocabulary.md`.
9. `docs/architecture/therapist-schema-evolution-matrix.md`.
10. `src/lib/routes.ts` e `src/domain/tes`.
11. `docs/architecture/agenda-sessions-preparation.md`.
12. `docs/architecture/adr/ADR-006-therapist-schedule-configuration.md`.
13. `docs/architecture/adr/ADR-007-therapist-availability-blocks.md`.
14. `skills/tes-ui-experience/SKILL.md` para experiência e direção visual.
15. `skills/tes-design-system/SKILL.md` para tokens, patterns e componentes.

## Contrato visual da feature

- Densidade dominante: `Operational` no calendário, filtros e comandos;
  `Balanced` no right rail, empty states e orientação.
- Composition patterns aplicáveis: `PageHeader`, `SegmentedNavigation`,
  `CommandBar`, `FilterBar`, `Timeline`, `ContextRail`, `InsightPanel` e
  `StatusCluster`.
- Regras universais de hierarquia, surfaces, tipografia, responsividade,
  componentização e Visual QA pertencem às skills globais. Esta skill mantém
  somente as decisões específicas de Agenda/Sessões e seu domínio.

## Rotas

- Agenda: `/terapeuta/agenda`.
- Sessões: `/terapeuta/sessoes`.
- Detalhe: `/terapeuta/sessoes/:bookingId`.
- Sala dedicada: `/terapeuta/sessoes/:bookingId/video`.
- Paciente: `/app/encontros` e `/app/encontros/:bookingId`.
- Aliases `/basico/*`, `/pro/*` e `/plus/*` são somente redirects.

## Contratos

- Reserva: `BookingStatus`.
- Pagamento: `session_payments.financial_status`.
- Realização: `FulfillmentStatus`.
- Presença: `AttendanceStatus`.
- Reagendamento: `RescheduleStatus`.
- Erros: `TesDomainError` e `DomainErrorCode`.

Não criar enums equivalentes dentro de features.

`confirmed_bilateral` é o estado canônico de realização concluída após as
duas confirmações. Os parsers de Agenda e Sessões devem aceitá-lo e
apresentá-lo como `Realizada`; os estados `confirmed_by_patient_review`,
`confirmed_by_therapist` e `auto_confirmed` permanecem somente para leitura
histórica.

## Leitura

- Agenda usa `get_therapist_agenda_v1`.
- Calendário usa `get_therapist_calendar_v1` para as visões dia, semana e mês.
- Sessões usa `get_therapist_sessions_v1` e cursor `(startsAt, bookingId)`.
- Detalhe usa `get_therapist_session_detail_v1`.
- Shell usa `get_therapist_shell_counters_v1`, nunca o dashboard completo.
- Identidade vem de `auth.uid()`; RPC de leitura não recebe therapist ID.
- Componentes recebem DTO validado e `SessionPresentation`.
- Resultado de leitura é `success`, `empty` ou `error`; não transformar falha
  em coleção vazia.

## Sessões

- A página `/terapeuta/sessoes` usa o frame Figma `13366:2768`
  (`Page / Terapeuta Pro / Sessões`) como referência visual.
- A tela lista apenas dados do `get_therapist_sessions_v1`; não cria booking,
  não confirma pagamento, não cria sala Zoom e não executa transições
  financeiras.
- Métricas, faixa de resumo, busca textual e exportação CSV são derivados dos
  itens carregados no read model da página.
- A composição de Sessões usa o grid compartilhado `AppPage*`: cabeçalho aberto
  com título em IvyPresto, região principal operacional e ContextRail de 320px
  no desktop. Os indicadores possuem ícone semântico e usam duas colunas em
  mobile quando a leitura permanecer suficiente.
- A lista usa somente o filtro de status de booking; o status financeiro continua
  no read model para compor estados operacionais e a tela de detalhe, mas não é
  exposto como filtro ou coluna na listagem. O
  parâmetro legado `modality` só pode ser `online` ou ausente; a UI não oferece
  escolha de formato porque o TES é online-only.
- A busca por texto filtra cliente e terapia no recorte carregado; paginação
  continua preservando os filtros suportados e o texto da busca.
- Ações de sala apontam primeiro para `/terapeuta/sessoes/:bookingId`; o
  detalhe direciona para `/terapeuta/sessoes/:bookingId/video`, onde a
  autorização final continua por `zoom-video-session-access`.
- A tabela desktop não possui coluna de Zoom ou link de sala. Quando o mapper
  autoritativo indicar `ready`, `in_progress` ou `room_preparing`, a identidade
  da pessoa recebe um único badge contextual. O badge não concede acesso nem
  antecipa uma janela de reunião; a autorização final continua no detalhe.
- O ID completo da reserva aparece como referência operacional logo abaixo do
  nome do paciente na tabela, nos cards e no detalhe da sessão, usando o mesmo
  `bookingId` da navegação.
- Desktop usa tabela operacional com right rail. Mobile usa cards cronológicos
  em uma coluna, com filtros em largura total e os mesmos links de detalhe;
  tablet pode promover o rail para duas colunas somente quando houver largura
  suficiente para preservar a leitura. No rail, cards mantêm altura de
  conteúdo e são empilhados em fluxo de bloco no desktop.
- O detalhe `/terapeuta/sessoes/:bookingId` preserva o mesmo grid `AppPage*`:
  breadcrumb, título IvyPresto, resumo de identidade/estado, superfícies de
  pagamento e sala, preparação e ContextRail compacto. A referência raster da
  rotina de atendimento serve à composição, não para inventar dados ou ações.
- O detalhe acompanha a anatomia do detalhe de encontro do paciente sem
  reproduzir seu domínio: cabeçalho aberto, hero com identidade / horário e
  sala / estado e ação, faixa de três estados e sequência responsiva de
  contexto, sala, gestão e apoio. Em desktop, suporte e orientações ficam no
  rail; em mobile, entram no fluxo após o contexto crítico.
- O detalhe só renderiza o DTO de `get_therapist_session_detail_v1`. Não exibir
  objetivo clínico, observações, prontuário, URL da sala, credenciais ou
  supostos resultados de teste técnico. A preparação pode orientar a pessoa
  terapeuta, mas não pode afirmar que câmera, microfone ou conexão já foram
  validados.
- Abrir a sala usa exclusivamente `/terapeuta/sessoes/:bookingId/video`; a
  janela, pagamento, perfil responsável e elegibilidade são revalidados no
  backend a cada acesso. Reagendar e cancelar reutilizam
  `SessionOperationActions`, sem atalhos paralelos.
- Depois de `endsAt`, o detalhe não oferece mais ações de acompanhar sala nem
  status da sala. Se `get_session_feedback_v2` retornar `eligible`, o CTA é
  `Confirmar sessão` para `/terapeuta/sessoes/:bookingId/video?feedback=1`;
  `submitted` e `unavailable` mostram somente o estado honesto. A autorização
  final permanece no backend e esta rota operacional continua disponível para
  Free, Premium e Premium Plus.
- Quando o booking, o pagamento ou a realização já estiverem encerrados
  (incluindo pagamento cancelado, reembolso ou sessão não realizada),
  `SessionOperationActions` mantém cancelamento e reagendamento desabilitados e
  informa o motivo em texto acessível; não repetir uma ação já concluída.
- No detalhe, o ContextRail mantém somente sua altura de conteúdo. Em tablet e
  mobile, as superfícies de apoio podem ocupar duas colunas quando houver
  espaço legível; o conteúdo principal permanece em uma sequência vertical.

## Disponibilidade

- A aba Horários usa o frame Figma `13366:7977` e a rota canônica
  `/terapeuta/agenda?aba=horarios`.
- A3 usa `get_therapist_schedule_v1` para leitura e
  `save_therapist_schedule_v1` por meio da Edge Function
  `therapist-schedule-update` para escrita autenticada.
- O fechamento A3 e sua matriz de evidências estão em
  `docs/architecture/agenda-a3-closure.md`.
- O Calendário usa o frame Figma `13366:5342` e persiste estado navegável em
  `aba=calendario`, `visao=day|week|month` e `data=YYYY-MM-DD`.
- A composição visual do Calendário segue o frame `13366:5342`: título em
  `font-display` itálico, copy “Organize seus horários, acompanhe suas
  sessões e mantenha sua agenda sempre atualizada.”, tabs Calendário /
  Horários / Bloqueios, alternância Dia / Semana / Mês, seletor de período,
  grade e right rail. Tratar a imagem de referência como fonte da copy apenas
  quando o node Figma não puder ser lido pelo MCP.
- Reutilizar os tokens TES e os componentes existentes. Não criar uma grade,
  sidebar, modal ou botão paralelo; detalhes de sessão usam `TESDialog`.
- Posicionar filtros de calendário imediatamente antes da área da agenda. Eles
  iniciam abertos em desktop e recolhidos em mobile, sem deslocar a descoberta
  operacional para depois da grade ou do right rail.
- No cabeçalho semanal, aplicar padding vertical explícito e uniforme nos dias.
  A separação da grade deve ocorrer pelo respiro, não por uma linha horizontal;
  o primeiro marcador de hora deve compartilhar o centro da borda superior da
  primeira faixa, usando o mesmo eixo vertical dos demais marcadores.
- Os limites da grade de Dia e Semana devem ser derivados das regras ativas de
  `get_therapist_schedule_v1()` nos dias visíveis, incluindo bookings, holds e
  bloqueios para que nenhum evento fique cortado. `08:00–22:00` é somente o
  fallback sem regras ou eventos; uma faixa configurada em `00:00–06:00` deve
  exibir a madrugada. O modelo atual não aceita uma única regra atravessando a
  meia-noite: use faixas separadas em cada dia quando esse cenário existir.
- Na Timeline da Agenda, rótulos da primeira linha/coluna não podem cruzar
  bordas; eventos precisam de padding interno e a primeira hora deve começar
  abaixo do cabeçalho dos dias.
- Desktop mantém grade com ContextRail; em tablet o rail vira duas colunas; em
  mobile a grade vira lista cronológica. Esta transformação é específica da
  Agenda e complementa as regras responsivas globais.
- No mobile, a legenda e a distribuição de demanda iniciam recolhidas; o
  heatmap completo permanece visível a partir de tablet. Essas informações são
  apoio e nunca antecedem a lista cronológica.
- O seletor de período deve continuar acessível por teclado e manter as ações
  de período anterior, próximo e Hoje. Filtros locais podem ser recolhidos
  abaixo do conteúdo principal, mas permanecem disponíveis e não alteram a
  URL nem o contrato do read model.
- Copy operacional canônica: “Sessões de hoje”, “Pendências da agenda”,
  “Acompanhe sua agenda”, “Dica do TES” e “Clique em um horário para ver
  ou editar o agendamento.”
- O fechamento A6/A7 fica em
  `docs/architecture/agenda-a6-a7-closure.md`.
- O fechamento A8/A10 fica em
  `docs/architecture/agenda-a8-a10-closure.md`.
- O Calendário possui filtros locais por busca, terapia e estado, além de lista
  cronológica mobile dedicada. Esses filtros não alteram o contrato
  `get_therapist_calendar_v1`.
- A UI edita faixas somente por terapia e preserva regras das outras terapias
  no comando atômico. Não oferecer "Todas as terapias" nem enviar
  `availability_rules.service_id` nulo.
- Sem terapia cadastrada, mostrar estado vazio com acesso a "Suas terapias";
  não renderizar controles de edição sem um escopo válido.
- Os horários das faixas são escolhidos exclusivamente em listas suspensas de
  15 minutos; não usar campo de horário digitável. Valores históricos fora do
  intervalo devem continuar visíveis como opção para que uma edição não os
  descarte silenciosamente.
- Na aba Horários, a navegação entre Calendário / Horários / Bloqueios segue o
  padrão de controle segmentado. O resumo de disponibilidade usa os dados
  reais de horas e dias configurados, com ícone contextual e sem estimar horas
  indisponíveis.
- Ícones de título nos cards do right rail permanecem lineares, sem superfícies
  decorativas próprias. Datas de exceções usam o formato numérico `dd/MM`.
- As três abas compartilham o mesmo chrome da Agenda: largura máxima de
  `1210px`, cabeçalho aberto, título em `font-display` IvyPresto itálico,
  supporting copy canônica, tabs de base aberta e grid principal + ContextRail
  em desktop. Horários e Bloqueios não podem introduzir cabeçalho, tab bar ou
  largura paralelos ao Calendário.
- O editor permite digitar e manter temporariamente uma faixa sobreposta no
  mesmo dia da mesma terapia. Faixas de terapias diferentes são independentes.
  Ao sair do campo, exibe o aviso de sobreposição; enquanto o
  conflito existir, o salvamento permanece bloqueado. O comando transacional e
  o banco continuam sendo a autoridade final contra concorrência, replay e
  escrita fora da interface.
- O payload de Horários só pode reenviar regras e settings de terapias presentes
  no read model editável. Regras órfãs de terapia arquivada não devem transformar
  um ajuste válido em `schedule_service_forbidden`; a validação autoritativa
  continua no RPC.
- Duração pertence ao serviço e `slotStepMinutes` controla o intervalo das sessões
  na interface. O nome técnico permanece no contrato para compatibilidade.
  `bufferBeforeMinutes` e `bufferAfterMinutes` continuam preservados no domínio
  e no cálculo autoritativo, mas não são controles expostos na UI de Horários.
  O buffer anterior amplia a ocupação sem deslocar o primeiro slot da faixa; a
  duração e o buffer posterior devem caber antes do fim configurado.
- O resumo geral une faixas iguais ou parcialmente sobrepostas de terapias
  diferentes antes de somar minutos. O potencial financeiro F3 aplica
  bloqueios no escopo correto e desconta a ocupação global de bookings pagos
  com os buffers snapshot; nunca tratar terapias como capacidade paralela.
- Não exibir toggle de reagendamento automático antes do domínio e dos
  comandos correspondentes.
- A aba Bloqueios usa o frame Figma `13366:8393`, o read model
  `get_therapist_blocks_v1` e a Edge `therapist-blocks-update`.
- Bloqueios usa lista compacta, right rail contextual, visão mensal e regras
  reais. Não substituir essa composição por uma grade genérica de KPIs.
- Pop-ups de Horários e Bloqueios usam `TESDialog`; não criar overlay local
  dentro da feature.
- A aba Horários apresenta informações contextuais acessíveis para intervalo
  de oferta, fuso horário e antecedência mínima. O texto reforça a referência
  operacional de São Paulo/Brasília para terapeutas que atendem de fora do
  Brasil.
- O comando de criação usa `create_therapist_block_v2` na Edge Function. Além
  dos impactos A4 já registrados, ele retorna somente as sessões confirmadas
  cuja fonte financeira canônica está em `session_payments.financial_status =
'paid'`, com data, horário, pessoa, terapia e fuso para o alerta imediato.
  A criação continua sem cancelar ou reagendar booking.
- `availability_exceptions` é a autoridade dos intervalos materializados;
  `availability_exception_series` representa recorrência e não substitui as
  ocorrências.
- Criar bloqueio nunca altera booking. Impactos são registrados em
  `availability_exception_booking_impacts` e exigem resolução explícita.
- Cancelamento/reagendamento de booking continuam nos comandos próprios.
- O preview TypeScript não confirma reserva nem deve alimentar novos fluxos.
- O read model `public_therapist_search_internal` calcula `next_slot_at` como o
  menor slot autoritativo entre todos os serviços ativos online do terapeuta;
  o serviço-resumo continua responsável apenas por preço e terapia exibidos no
  cartão. Como o slot engine aplica o limite antes de excluir bookings e holds,
  a busca de descoberta divide o horizonte em janelas de cinco dias e pede 500
  candidatos por janela. A cadência canônica mínima de 15 minutos mantém cada
  janela integralmente coberta; limitar em um candidato bruto pode produzir
  `Horários em breve` apesar de haver disponibilidade real.
- A5 usa `get_service_available_slots_v1` como endpoint público autoritativo e
  repete a validação no trigger de `booking_holds`. A agenda pública usa ainda
  `get_service_available_days_v1` para navegação mensal e
  `get_service_available_day_slots_v1` para o detalhe de um dia, sem expor
  ocupação ou participantes.
- `max_days_ahead` tem default canônico de 90 dias e todas as configurações de
  serviço existentes são normalizadas para 90; o hold continua rejeitando um
  início fora desse horizonte.
- `therapies.calendar_color_key` é a chave canônica de cor. Nunca persistir
  classe Tailwind ou valor visual arbitrário no banco.
- Booking do terapeuta bloqueia todos os serviços no mesmo intervalo.
- Aplicar buffers e validar intervalos.
- O Postgres protege holds e bookings e compõe slots autoritativos com regras,
  exceções, timezone, duração, cadência, buffers, antecedência e horizonte.
- `booking_holds` usa TTL, idempotência, snapshots e advisory lock por
  terapeuta. O checkout público chama `reservation-abandon` ao ser deixado sem
  conclusão; a Edge Function expira antes o Checkout Stripe ainda aberto e só
  então cancela bookings `draft`/`pending_payment` sem pagamento confirmado,
  com idempotência e autorização do paciente. Checkout concluído não pode ser
  liberado pelo navegador: o webhook continua sendo a autoridade do pagamento.
- Na comparação visual de conflitos da pessoa paciente, só entram bookings
  `confirmed`/`completed` que possuam pagamento canônico
  `session_payments.financial_status = 'paid'`. Holds e reservas sem pagamento
  não podem esconder um horário como se fossem outro encontro. Eles continuam
  sendo protegidos pelo PostgreSQL para a disponibilidade do terapeuta até a
  expiração ou o abandono autorizado; o banco permanece a autoridade final
  contra sobreposição.
- `occupied_during` e constraints GiST impedem conflito entre serviços.
- Um reembolso integral confirmado na fonte canônica
  `session_payments.financial_status = 'refunded'` move o booking para
  `refunded`, preserva o histórico e libera o intervalo ocupado. A
  reconciliação é idempotente, registra `booking_events` e alcança também
  reembolsos integrais históricos que ficaram com booking ativo.
- Reembolso parcial e disputa não liberam horário automaticamente, porque a
  sessão ainda pode permanecer válida; qualquer encerramento operacional deve
  ocorrer pelo fluxo próprio.
- O calendário privado continua exibindo sessões canceladas e reembolsadas no
  histórico do período. Timeline, mês e lista mobile usam padrão diagonal,
  legenda e estado textual para não depender somente de cor.

## Comandos transacionais A2

- `reserve_booking_hold_v1`: cria hold somente via backend confiável.
- `consume_booking_hold_v1`: converte hold em um booking `draft`.
- `session-booking-checkout`: Edge Function autenticada para pessoa paciente;
  seleciona slot por `get_service_available_slots_v1`, reserva hold
  idempotente, consome hold em booking e inicia `stripe-create-session-payment`.
- `transition_booking_status_v1`: aplica transição operacional e auditoria.
- `request_booking_reschedule_v1`: cria proposta versionada.
- `resolve_booking_reschedule_v1`: aplica resolução e sincroniza a sessão local de vídeo.
- `session-reschedule`: Edge Function autenticada para paciente ou terapeuta;
  valida participação, seleciona o slot por `get_service_available_slots_v1` e
  então chama `request_booking_reschedule_v1` ou
  `resolve_booking_reschedule_v1`.
- `request-session-cancellation`: continua sendo a função canônica de
  cancelamento de sessão, política de reembolso e bloqueio de repasse quando
  necessário.
- `session_payments` continua sendo a única fonte financeira.
- O checkout de sessão deve usar o snapshot do booking, nunca o preço atual do
  serviço.
- A confirmação de pagamento continua exclusivamente em webhook Stripe; retorno
  de Checkout e `session-booking-checkout` não confirmam pagamento, plano, Zoom
  ou repasse.
- A9 pode ser pulado por escopo, mas isso não autoriza criar novo gate Zoom; o
  acesso segue em `zoom-video-session-access`.
- RPCs de escrita são `service_role` only e devem ser chamados por Edge
  Functions que autenticam e autorizam o usuário.

## Privacidade e segurança

- Não expor notas privadas, Match, dados médicos ou URL de host.
- Paciente e terapeuta leem o mesmo booking por DTOs permitidos.
- Pagamento é confirmado apenas por webhook.
- Sessão local de vídeo só é criada depois do pagamento confirmado.
- Clique do frontend nunca cria sessão real nem define papel; ele solicita acesso ao backend.
- Terapeuta recebe `role_type=1` somente por backend, quando responsável pela booking.
- Toda consulta autenticada usa RLS.
- Acesso Zoom definitivo usa `zoom-video-session-access`; a previsão do read model
  nunca substitui a autorização no clique.

## QA

- Aplicar `docs/design-system/visual-qa.md` e o gate de
  `docs/design-system/visual-quality-score.md`.
- Para o Calendário, além do gate global, conferir tabs, seletor de período,
  grade/lista, range derivado de schedule/eventos e ausência de corte na
  madrugada.
- Validar que todo diálogo cobre sidebar e topbar, bloqueia scroll, fecha por
  `Escape`, confina e devolve foco.
- Testar seleção de terapia, ausência de opção geral, ativação por dia,
  cópia entre dias, conflito de versão e falha real distinta de vazio.
- O script `npm run test:deno` deve incluir
  `supabase/functions/therapist-schedule-update` e
  `supabase/functions/therapist-blocks-update` e
  `supabase/functions/session-booking-checkout` e
  `supabase/functions/session-reschedule`.
- O pgTAP A3 deve cobrir grants, RLS, advisory lock, stale version, replay,
  auditoria, sobreposição, timezone e propriedade do serviço.
- O pgTAP A4 deve cobrir séries, ocorrências UTC, impactos, booking preservado,
  versão compartilhada, replay, remoção lógica, RLS e terapeuta suspenso.
- O pgTAP de conflito pago deve confirmar que sessões confirmadas e pagas
  retornam detalhes reais e que sessões sem pagamento `paid` não entram no
  alerta.
- O pgTAP A5 deve cobrir privacidade pública, slots, bloqueios, bookings, holds,
  RLS, identidade, terapeuta suspenso e calendário versionado.
- Testar conflito entre serviços, buffers, exceções e período vazio.
- Testar a prevenção local de faixa sobreposta, incluindo intervalos contíguos
  na mesma terapia e faixas independentes de terapias distintas.
- Testar três terapias com durações e buffers distintos começando exatamente no
  início configurado, além de bloqueio global por hold/booking e liberação por
  expiração/cancelamento.
- Testar transições permitidas e proibidas.
- Testar paciente e terapeuta com o mesmo horário e serviço.
- Testar RLS entre terapeutas.
- Preservar o volume local: rodar `npx supabase db push --local --dry-run`,
  `npx supabase db push --local`, `npx supabase db lint --schema public` e os
  pgTAP focados. Não usar `db reset` sem autorização explícita.
- Rodar typecheck, lint, Vitest e build.
