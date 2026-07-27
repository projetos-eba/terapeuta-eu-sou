# ADR-007 - Bloqueios de disponibilidade do terapeuta

Data: 2026-07-27

Status: aceito e implementado no marco A4.

## Contexto

`availability_exceptions` já era a fonte de exceções simples, mas não
representava recorrência, cancelamento lógico, impacto sobre reservas,
idempotência ou auditoria. Criar um segundo catálogo de bloqueios faria A5
precisar reconciliar duas autoridades.

O Figma de Bloqueios é o node `13366:8393`. Nesta execução, o MCP do Figma não
estava disponível e o navegador conectado também não pôde ser iniciado. O
endpoint público oEmbed confirmou o arquivo e o node, mas sua miniatura
retornou apenas a capa do arquivo. A composição visual foi, portanto, alinhada
ao frame de Agenda/Horários já implementado e aos tokens TES; detalhes internos
do frame não confirmados não foram inventados.

## Decisão

- `availability_exceptions` continua sendo a autoridade dos intervalos
  materializados que A5 deverá subtrair.
- `availability_exception_series` armazena a intenção recorrente e seu
  timezone de negócio.
- Recorrências `daily` e `weekly` são materializadas como instantes UTC por
  ocorrência, preservando a data local e limitadas a um ano e 90 ocorrências.
- `availability_exception_booking_impacts` relaciona bloqueios a bookings já
  existentes.
- Criar um bloqueio nunca cancela, reembolsa ou reagenda um booking.
- A resolução disponível em A4 é `keep_booking`. Cancelamento e reagendamento
  continuam usando seus próprios comandos de domínio.
- Remoção de ocorrência ou série é lógica (`cancelled`), preservando histórico.
- A versão de `therapist_schedule_settings` é compartilhada com Horários para
  impedir sobrescrita concorrente entre as abas.
- Escritas passam pela Edge Function `therapist-blocks-update` e RPCs
  `service_role` only.
- Leitura usa `get_therapist_blocks_v1()`, que deriva o terapeuta de
  `auth.uid()`.

## Segurança e observabilidade

- RLS limita séries, impactos e eventos ao terapeuta responsável.
- Pacientes não acessam o read model nem as tabelas A4.
- A Edge valida access token, papel e status antes do comando.
- Advisory lock serializa comandos por terapeuta.
- `requestId` torna criação, remoção e resolução idempotentes.
- Logs incluem operação, correlation ID, papel, código sanitizado e duração.
- Eventos não armazenam tokens, dados clínicos, payloads Stripe ou Zoom.

## Consequências

- A5 pode consumir intervalos simples e indexados sem interpretar regras de
  recorrência.
- Sessões impactadas ficam visíveis e exigem decisão explícita.
- Notificação interna é criada quando o bloqueio encontra bookings.
- Participantes não recebem comunicação porque o booking não mudou. Quando a
  terapeuta escolher cancelar ou reagendar, o workflow correspondente deverá
  notificar as partes.
- Edição de uma série ativa não faz parte de A4; a operação segura atual é
  remover e criar uma nova série.

## Alternativas rejeitadas

- Criar `schedule_blocks`: rejeitada por duplicar
  `availability_exceptions`.
- Salvar RRULE sem ocorrências: rejeitada porque transferiria recorrência e DST
  para toda consulta do motor de slots.
- Cancelar bookings ao criar bloqueio: rejeitada por misturar ciclos de vida e
  produzir efeitos financeiros silenciosos.
- Autorizar pelo frontend: rejeitada por concorrência, RLS e timezone.
