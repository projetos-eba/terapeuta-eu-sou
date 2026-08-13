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
- Filtros por status de booking e status financeiro permanecem na URL. O
  parâmetro legado `modality` só pode ser `online` ou ausente; a UI não oferece
  escolha de formato porque o TES é online-only.
- A busca por texto filtra cliente e terapia no recorte carregado; paginação
  continua preservando os filtros suportados e o texto da busca.
- Ações de sala apontam primeiro para `/terapeuta/sessoes/:bookingId`; o
  detalhe direciona para `/terapeuta/sessoes/:bookingId/video`, onde a
  autorização final continua por `zoom-video-session-access`.
- Desktop usa tabela operacional com right rail. Tablet e mobile usam cards
  cronológicos empilhados, filtros em largura total e os mesmos links de
  detalhe.

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
  `font-display` itálico, copy “Organize seus horários, acompanhe seus
  encontros e mantenha sua agenda sempre atualizada.”, tabs Calendário /
  Horários / Bloqueios, alternância Dia / Semana / Mês, seletor de período,
  grade e right rail. Tratar a imagem de referência como fonte da copy apenas
  quando o node Figma não puder ser lido pelo MCP.
- Reutilizar os tokens TES e os componentes existentes. Não criar uma grade,
  sidebar, modal ou botão paralelo; detalhes de encontro usam `TESDialog`.
- Aplicar a regra de legibilidade TES: texto funcional com pelo menos `14px`;
  metadados secundários com mínimo de `11px` no desktop e `10px` no mobile.
  Nunca usar `8px` ou `9px`; para microtexto responsivo usar
  `text-[10px] md:text-[11px]`.
- Posicionar filtros de calendário imediatamente antes da área da agenda. Eles
  iniciam abertos em desktop e recolhidos em mobile, sem deslocar a descoberta
  operacional para depois da grade ou do right rail.
- No cabeçalho semanal, aplicar padding vertical explícito e uniforme nos dias.
  A separação da grade deve ocorrer pelo respiro, não por uma linha horizontal;
  o primeiro marcador de hora começa abaixo do topo da grade e nunca toca uma
  borda ou divisória.
- Os limites da grade de Dia e Semana devem ser derivados das regras ativas de
  `get_therapist_schedule_v1()` nos dias visíveis, incluindo bookings, holds e
  bloqueios para que nenhum evento fique cortado. `08:00–22:00` é somente o
  fallback sem regras ou eventos; uma faixa configurada em `00:00–06:00` deve
  exibir a madrugada. O modelo atual não aceita uma única regra atravessando a
  meia-noite: use faixas separadas em cada dia quando esse cenário existir.
- Conferir sobreposição antes de concluir: rótulos da primeira linha/coluna de
  grades não podem cruzar bordas; eventos precisam de padding interno e cards,
  legendas e tabelas devem preservar respiro uniforme nas bordas.
- Desktop mantém grade com right rail; em tablet o right rail vira duas
  colunas; em mobile a grade vira lista cronológica e controles, ações e tabs
  permanecem operáveis sem rolagem horizontal da página. Preservar a rolagem
  interna apenas para a grade de calendário quando necessária.
- O seletor de período deve continuar acessível por teclado e manter as ações
  de período anterior, próximo e Hoje. Filtros locais podem ser recolhidos
  abaixo do conteúdo principal, mas permanecem disponíveis e não alteram a
  URL nem o contrato do read model.
- Copy operacional canônica: “Encontros de hoje”, “Pendências da agenda”,
  “Insights para sua agenda”, “Insight TES” e “Clique em um horário para ver
  ou editar o agendamento.”
- O fechamento A6/A7 fica em
  `docs/architecture/agenda-a6-a7-closure.md`.
- O fechamento A8/A10 fica em
  `docs/architecture/agenda-a8-a10-closure.md`.
- O Calendário possui filtros locais por busca, terapia e estado, além de lista
  cronológica mobile dedicada. Esses filtros não alteram o contrato
  `get_therapist_calendar_v1`.
- A UI edita faixas em escopo geral ou por terapia e preserva regras dos
  outros escopos no comando atômico.
- Duração pertence ao serviço e `slotStepMinutes` significa intervalo de oferta.
  `bufferBeforeMinutes` e `bufferAfterMinutes` continuam preservados no domínio
  e no cálculo autoritativo, mas não são controles expostos na UI de Horários.
- Não exibir toggle de reagendamento automático antes do domínio e dos
  comandos correspondentes.
- A aba Bloqueios usa o frame Figma `13366:8393`, o read model
  `get_therapist_blocks_v1` e a Edge `therapist-blocks-update`.
- Bloqueios usa lista compacta, right rail contextual, visão mensal e regras
  reais. Não substituir essa composição por uma grade genérica de KPIs.
- Pop-ups de Horários e Bloqueios usam `TESDialog`; não criar overlay local
  dentro da feature.
- `availability_exceptions` é a autoridade dos intervalos materializados;
  `availability_exception_series` representa recorrência e não substitui as
  ocorrências.
- Criar bloqueio nunca altera booking. Impactos são registrados em
  `availability_exception_booking_impacts` e exigem resolução explícita.
- Cancelamento/reagendamento de booking continuam nos comandos próprios.
- O preview TypeScript não confirma reserva nem deve alimentar novos fluxos.
- A5 usa `get_service_available_slots_v1` como endpoint público autoritativo e
  repete a validação no trigger de `booking_holds`.
- `therapies.calendar_color_key` é a chave canônica de cor. Nunca persistir
  classe Tailwind ou valor visual arbitrário no banco.
- Booking do terapeuta bloqueia todos os serviços no mesmo intervalo.
- Aplicar buffers e validar intervalos.
- O Postgres protege holds e bookings e compõe slots autoritativos com regras,
  exceções, timezone, duração, cadência, buffers, antecedência e horizonte.
- `booking_holds` usa TTL, idempotência, snapshots e advisory lock por
  terapeuta.
- `occupied_during` e constraints GiST impedem conflito entre serviços.

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

- Validar Horários em desktop, tablet e mobile; controles devem ter área de
  toque de pelo menos 44px, foco visível e rótulos acessíveis.
- Para o Calendário, validar visualmente em navegador visível nos breakpoints
  desktop, tablet e mobile; capturar screenshot, conferir tabs, seletor de
  período, grade/lista, cards do right rail, foco dos controles e ausência de
  rolagem horizontal da página.
- Validar que todo diálogo cobre sidebar e topbar, bloqueia scroll, fecha por
  `Escape`, confina e devolve foco.
- Testar seleção de terapia, herança de faixas gerais, ativação por dia,
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
- O pgTAP A5 deve cobrir privacidade pública, slots, bloqueios, bookings, holds,
  RLS, identidade, terapeuta suspenso e calendário versionado.
- Testar conflito entre serviços, buffers, exceções e período vazio.
- Testar transições permitidas e proibidas.
- Testar paciente e terapeuta com o mesmo horário e serviço.
- Testar RLS entre terapeutas.
- Rodar `npx supabase db reset`, `npx supabase db lint --schema public` e
  `npx supabase test db`.
- Rodar typecheck, lint, Vitest e build.
