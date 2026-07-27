# ADR-005 - Autoridade da disponibilidade

Data: 2026-07-25

Status: aceito.

Implementação: invariantes transacionais concluídos na A2 em 2026-07-26;
configuração versionada concluída em A3.0/A3.1 conforme ADR-006; composição
autoritativa de slots concluída em A5 em 2026-07-27.

## Contexto

O serviço TypeScript atual gera preview para o perfil público, mas não oferece
garantia transacional e interpreta os dias no timezone do runtime.

## Decisão

- O preview TypeScript continua apenas para apresentação.
- Todo booking do terapeuta bloqueia o horário, independentemente do serviço.
- Buffers fazem parte do intervalo ocupado.
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

Consumidores de reserva devem migrar do preview TypeScript para
`get_service_available_slots_v1`. A UI deve tratar `SLOT_NOT_AVAILABLE`,
`SLOT_HELD_BY_ANOTHER_USER` e `BOOKING_CONFLICT`, permitindo nova escolha. A2
continua sendo a barreira final contra duas reservas ativas para o mesmo
terapeuta.
