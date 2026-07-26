# ADR-005 - Autoridade da disponibilidade

Data: 2026-07-25

Status: aceito.

Implementação: invariantes transacionais parciais concluídos na A2 em
2026-07-26; composição autoritativa de slots permanece para A5.

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
- O motor A5 ainda deve compor regras, exceções, timezone, antecedência e
  horizonte antes de chamar as primitivas A2.

## Alternativas

- Confirmar pelo preview: rejeitada por concorrência e timezone.
- Adicionar biblioteca de calendário agora: rejeitada; a Fase 1 não precisa de
  nova dependência.

## Consequências

O preview pode divergir do resultado autoritativo em fronteiras de timezone. A
UI deve tratar `SLOT_NOT_AVAILABLE`, `SLOT_HELD_BY_ANOTHER_USER` e
`BOOKING_CONFLICT`, permitindo nova escolha. Mesmo antes de A5, A2 impede que
essa divergência produza duas reservas ativas para o mesmo terapeuta.
