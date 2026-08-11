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
- O fechamento A6/A7 fica em
  `docs/architecture/agenda-a6-a7-closure.md`.
- O fechamento A8/A10 fica em
  `docs/architecture/agenda-a8-a10-closure.md`.
- O Calendário possui filtros locais por busca, terapia e estado, além de lista
  cronológica mobile dedicada. Esses filtros não alteram o contrato
  `get_therapist_calendar_v1`.
- A UI edita faixas em escopo geral ou por terapia e preserva regras dos
  outros escopos no comando atômico.
- Duração pertence ao serviço; `slotStepMinutes` significa intervalo de oferta,
  enquanto `bufferBeforeMinutes` e `bufferAfterMinutes` representam preparo.
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
