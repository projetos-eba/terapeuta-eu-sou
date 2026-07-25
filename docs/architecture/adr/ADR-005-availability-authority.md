# ADR-005 - Autoridade da disponibilidade

Data: 2026-07-25

Status: aceito.

## Contexto

O serviço TypeScript atual gera preview para o perfil público, mas não oferece
garantia transacional e interpreta os dias no timezone do runtime.

## Decisão

- O preview TypeScript continua apenas para apresentação.
- Todo booking do terapeuta bloqueia o horário, independentemente do serviço.
- Buffers fazem parte do intervalo ocupado.
- Faixas inválidas ou sobrepostas falham com erro de domínio.
- Exceções disponíveis e indisponíveis permanecem explícitas.
- A confirmação futura usa um slot engine transacional em Postgres/RPC.
- Holds terão TTL e idempotência antes da confirmação.

## Alternativas

- Confirmar pelo preview: rejeitada por concorrência e timezone.
- Adicionar biblioteca de calendário agora: rejeitada; a Fase 1 não precisa de
  nova dependência.

## Consequências

O preview pode divergir do resultado autoritativo em fronteiras de timezone. A
UI deve tratar `SLOT_NOT_AVAILABLE` e permitir nova escolha.
