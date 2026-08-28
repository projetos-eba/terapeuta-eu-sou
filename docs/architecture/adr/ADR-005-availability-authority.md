# ADR-005 - Autoridade da disponibilidade

Data: 2026-07-25

Status: aceito. Revisado em 2026-08-28.

Implementação: invariantes transacionais concluídos na A2 em 2026-07-26;
configuração versionada concluída em A3.0/A3.1 conforme ADR-006; composição
autoritativa de slots concluída em A5 em 2026-07-27.

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
- O motor A5 compõe regras, exceções, timezone, duração, cadência, buffers,
  antecedência e horizonte antes de expor um slot.
- O endpoint público subtrai bookings e holds sem revelar participantes ou a
  causa da indisponibilidade.
- A criação do hold repete a validação autoritativa no Postgres; o resultado
  público não substitui a proteção transacional A2.

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
`SLOT_HELD_BY_ANOTHER_USER` e `BOOKING_CONFLICT`, permitindo nova escolha. A2
continua sendo a barreira final contra duas reservas ativas para o mesmo
terapeuta. O calendário privado preserva sessões encerradas no histórico e as
diferencia com estado textual e padrão visual, sem recolocá-las entre os
conflitos de disponibilidade.
