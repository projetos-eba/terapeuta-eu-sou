# ADR-005 - Autoridade da disponibilidade

Data: 2026-07-25

Status: aceito. Revisado em 2026-09-05.

Implementação: invariantes transacionais concluídos na A2 em 2026-07-26;
configuração versionada concluída em A3.0/A3.1 conforme ADR-006; composição
autoritativa de slots concluída em A5 em 2026-07-27.
Hotfix de conflito por paciente concluído em 2026-08-28.

## Contexto

O serviço TypeScript legado gerava preview para o perfil público, mas não
oferecia garantia transacional e interpretava os dias no timezone do runtime.

## Decisão

- O perfil público e a reserva consomem o RPC autoritativo; o preview TypeScript
  não pode alimentar horários reserváveis.
- Todo booking ativo do terapeuta bloqueia o horário, independentemente do
  serviço.
- Um reembolso integral na fonte financeira canônica sincroniza o booking para
  `refunded`, preservando o registro e liberando o intervalo protegido.
- Reembolso parcial e disputa não liberam disponibilidade automaticamente.
- Buffers fazem parte do intervalo ocupado. O buffer anterior não desloca o
  primeiro início da faixa; duração e buffer posterior precisam caber até o
  fim configurado.
- Cada faixa semanal exige `availability_rules.service_id`; disponibilidade
  geral histórica é migrada para regras explícitas de cada terapia.
- Faixas inválidas ou sobrepostas falham com erro de domínio.
- Exceções disponíveis e indisponíveis permanecem explícitas.
- Holds e bookings usam Postgres/RPC, TTL, idempotência, advisory lock e
  exclusão GiST por terapeuta.
- Toda escrita ativa adquire locks na ordem terapeuta e paciente. O lock do
  paciente usa namespace próprio. Para conflito pessoal, a autoridade considera
  bookings `confirmed`/`completed` pagos e `capture_pending` ainda reivindicados
  por `slot_claimed_at`; tentativas sem autorização e holds não representam um
  segundo encontro da pessoa.
- O conflito do paciente compara apenas `[starts_at, ends_at)`, sem buffers do
  terapeuta; um encontro que começa exatamente no término do anterior é válido.
- O motor A5 compõe regras, exceções, timezone, duração, cadência, buffers,
  antecedência e horizonte antes de expor um slot.
- O endpoint público subtrai bookings e holds sem revelar participantes ou a
  causa da indisponibilidade.
- A criação do hold repete a validação autoritativa no Postgres; o resultado
  público não substitui a proteção transacional A2.
- Reagendamento usa `get_booking_reschedule_availability_v1`, sempre derivado do
  `booking_id`. Serviço, preço, duração, buffers e timezone vêm dos snapshots do
  booking; o navegador informa somente o novo início escolhido.
- Proposta não cria hold e não libera o intervalo original. Criação e aceite
  revalidam regras, exceções, antecedência, horizonte, bloqueios e conflitos sob
  locks. O mesmo booking muda de intervalo somente no aceite atômico; rejeição,
  retirada, expiração ou indisponibilidade preservam o intervalo original.
- Uma expiração gera `booking_reschedule_resolved` determinístico para sustentar
  notificações e e-mails idempotentes. Se o slot se perder antes do aceite, a
  proposta é encerrada como indisponível e o booking não é movido.

## Alternativas

- Confirmar pelo preview: rejeitada por concorrência e timezone.
- Adicionar biblioteca de calendário agora: rejeitada; a Fase 1 não precisa de
  nova dependência.

## Consequências

Consumidores de reserva usam `get_service_available_slots_v1`. A agenda mensal
usa `get_service_available_days_v1` para descobrir somente datas com algum
horário livre e `get_service_available_day_slots_v1` para detalhar uma data no
timezone do serviço. O horizonte canônico de reserva é de 90 dias; a UI nunca
deduz o fim desse horizonte pelo número de slots recebidos. A UI deve tratar
`SLOT_NOT_AVAILABLE`,
`SLOT_HELD_BY_ANOTHER_USER`, `BOOKING_CONFLICT` e
`PATIENT_SCHEDULE_CONFLICT`, permitindo nova escolha. A2
continua sendo a barreira final contra duas reservas ativas para o mesmo
terapeuta ou para o mesmo paciente. `/reserva` pode ocultar, mediante leitura
RLS do próprio paciente, horários que colidem com seus encontros; essa
prevenção visual nunca substitui o trigger. A exclusão GiST redundante por
paciente fica adiada para uma janela com auditoria de volume e impacto de lock.
O calendário privado preserva sessões encerradas no histórico e as
diferencia com estado textual e padrão visual, sem recolocá-las entre os
conflitos de disponibilidade.

O seletor público continua responsável por novas reservas e pode alternar entre
serviços. O seletor de reagendamento reutiliza somente sua linguagem visual:
ele usa o contrato específico do booking e nunca aceita troca de terapia ou de
condições comerciais.
