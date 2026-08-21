# Contratos de Mensagens e Suporte — TES

Data: 2026-08-21  
Status: Fase 2 implementada para terapeuta e com leitura/resposta mínima no
detalhe Admin; a Inbox administrativa completa permanece para a Fase 3.

## Estado real inventariado

| Superfície    | Contrato atual                                                                               | Observação da Fase 1                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Participante  | `conversations`, `messages`, `message_templates`, `POST /api/messages/send-template`         | A escrita passa exclusivamente pela RPC autenticada `send_structured_participant_message_v1`.                                   |
| Suporte       | `support_tickets`, `support_ticket_messages`, APIs `/api/support/tickets*`                   | Ticket e thread plain text para terapeuta, com idempotência, RLS por solicitante e contexto opcional autorizado.                |
| Administração | `/admin/suporte`, thread Admin, notas internas e comandos `support.resolve`/`support.reopen` | Pode ler a thread autorizada, responder publicamente e registrar nota interna sem expô-la ao solicitante.                       |
| Legado        | `structured_messages`                                                                        | Não identificado consumidor no runtime analisado. A tabela permanece por compatibilidade e não deve ser fundida com `messages`. |

O histórico de migrations local e de HML foi conferido em modo somente leitura e estava alinhado. O Supabase MCP não estava disponível nesta sessão.

## Bounded contexts e invariantes

### Structured Participant Messaging

Paciente e terapeuta podem comunicar somente texto previamente aprovado pelo TES. Atores: paciente e terapeuta participantes da mesma `conversation`.

- Entrada permitida: `conversationId` e `templateKey`; `actorRole` serve apenas para selecionar a sessão HTTP-only e é conferido contra o papel persistido.
- Entrada proibida: `body`, `message`, `description`, HTML, Markdown livre, anexos ou qualquer complemento digitado pelo participante.
- O banco resolve `templateKey` em `message_templates`, exige o contexto correto (`patient_to_therapist` ou `therapist_to_patient`) e persiste o texto e o `template_id` resolvidos.
- `messages` é a projeção operacional atual. A escrita REST direta de `authenticated` foi revogada; registros legados sem `template_id` permanecem legíveis.
- Não é permitido usar template para substituir cancelamento, reagendamento, pagamento ou outra operação canônica.

### Support Ticketing

Suporte é a relação entre o solicitante e o TES. Texto livre é permitido somente dentro de ticket autorizado; nunca reutiliza a API, tabela ou UI de mensagens entre participantes.

- Paciente e terapeuta abrem e leem somente tickets próprios.
- `requester_profile_id` e papel são derivados da sessão; o navegador não pode escolher outro solicitante.
- `booking_id`, quando aceito, precisa pertencer ao solicitante segundo a relação canônica de booking.
- Conteúdo é plain text, sem interpretação HTML ou Markdown e sem conteúdo em logs operacionais.
- E-mail é uma notificação futura; a thread autenticada será a fonte canônica.

## Matriz de autorização

| Capacidade                             | Paciente                 | Terapeuta                | Admin autorizado                |
| -------------------------------------- | ------------------------ | ------------------------ | ------------------------------- |
| Enviar template ao outro participante  | Sim, na própria conversa | Sim, na própria conversa | Fora do escopo                  |
| Texto livre ao outro participante      | Não                      | Não                      | Não                             |
| Abrir ticket próprio                   | Sim                      | Sim                      | Conforme operação               |
| Texto livre em ticket próprio (Fase 2) | Sim                      | Sim                      | Sim                             |
| Ler ticket de outro solicitante        | Não                      | Não                      | Sim, com `admin.support.manage` |
| Criar/ler nota interna                 | Não                      | Não                      | Sim, com `admin.support.manage` |
| Atribuir, priorizar, resolver, reabrir | Não                      | Não                      | Sim, com `admin.support.manage` |

## Contratos de API

### Envio estruturado vigente

`POST /api/messages/send-template`

```json
{
  "actorRole": "patient",
  "conversationId": "uuid",
  "templateKey": "patient_confirm_session"
}
```

O endpoint valida a sessão, confirma o papel persistido e chama somente a RPC `send_structured_participant_message_v1(uuid, text)`. A RPC deriva `auth.uid()`, valida ownership da conversa e sentido do template; portanto o `body` não faz parte do contrato e não é enviado à persistência.

Erros públicos: JSON inválido `400`, sessão ausente `401`, papel/conversa não autorizados `403`, template ou payload inválidos `422` e indisponibilidade `503`. A resposta de sucesso permanece `{ "ok": true }` com `201`.

### Criação de suporte vigente — Fase 2

`POST /api/support/tickets` aceita:

```json
{
  "requestId": "uuid",
  "category": "financeiro_repasses",
  "subject": "Dúvida sobre repasse",
  "description": "Descrição livre do problema.",
  "bookingId": null,
  "source": "message_center"
}
```

- Categorias fechadas: `agenda_sessoes`, `zoom_acesso`, `pagamentos`, `financeiro_repasses`, `plano_assinatura`, `perfil_verificacao`, `conta_acesso` e `outro`.
- Assunto: plain text normalizado, 3–120 caracteres.
- Descrição: plain text normalizado, 1–4.000 caracteres; quebras de linha são preservadas, marcação HTML é rejeitada e Markdown nunca é interpretado.
- `requestId` é obrigatório e idempotente por solicitante, preservando a constraint já existente em `support_tickets`.
- `actorRole` não será aceito: identidade, autoria e autorização vêm da sessão.

Contratos de thread vigentes, todos fora da API de participante:

- `GET /api/support/tickets`: tickets próprios paginados;
- `GET /api/support/tickets/:ticketId`: detalhe próprio, sem notas internas;
- `POST /api/support/tickets/:ticketId`: mensagem pública própria;
- `GET /api/admin/support/tickets/:ticketId/thread`: thread completa somente
  para Admin com `admin.support.read`, incluindo notas internas;
- `POST /api/admin/support/tickets/:ticketId/reply`: resposta pública sob
  `admin.support.manage`;
- `POST /api/admin/support/tickets/:ticketId/notes`: nota interna sob
  `admin.support.manage`; resolver/reabrir reutiliza o command auditado existente.

## Lifecycle de suporte vigente

| Evento autorizado                     | Estado resultante   | `waiting_on` | Efeito                                                 |
| ------------------------------------- | ------------------- | ------------ | ------------------------------------------------------ |
| Criação                               | `open`              | `support`    | `last_activity_at` recebe criação; `resolved_at` nulo. |
| Admin assume ou trabalha internamente | `in_progress`       | `support`    | Atualiza atividade.                                    |
| Admin envia resposta pública          | `waiting_requester` | `requester`  | Atualiza atividade.                                    |
| Solicitante envia mensagem pública    | `waiting_support`   | `support`    | Atualiza atividade; reabre ticket resolvido.           |
| Admin resolve                         | `resolved`          | nulo         | Define `resolved_at` e atualiza atividade.             |
| Admin reabre                          | `open`              | `support`    | Limpa `resolved_at` e atualiza atividade.              |

Nota interna, alteração de prioridade e atribuição atualizam `last_activity_at`, mas não podem expor conteúdo ou autor administrativo ao solicitante.

## Dados, RLS e compatibilidade da Fase 2

`support_ticket_messages` contém `id`, `ticket_id`, `author_profile_id` derivado, papel do autor, `body`, `visibility` (`requester` ou `internal`), `created_at` e `request_id`. A constraint `(ticket_id, author_profile_id, request_id)` bloqueia retries duplicados. A descrição inicial nova é materializada como primeira mensagem pública, portanto a thread é a fonte canônica da conversa. Tickets históricos sem thread retornam a descrição legada como primeira mensagem conceitual, sem backfill destrutivo.

Campos de `support_tickets` só serão adicionados com uso: `assigned_admin_id`, `last_activity_at`, `resolved_at` e `waiting_on`. Antes de constraint de status, a migration da Fase 2 deve fazer preflight dos valores existentes. Registros atuais e os comandos Admin `support.resolve`/`support.reopen` devem permanecer compatíveis.

RLS vigente:

- solicitante lê somente o próprio ticket e mensagens com `visibility = requester`;
- solicitante só cria mensagem pública em ticket próprio e estado permitido pela RPC;
- Admin opera por RPC administrativo explícito; a leitura de thread usa
  `admin_get_support_ticket_thread_v1` e nunca é reutilizada por requester;
- nota interna não participa de DTO, view, query nem policy do solicitante.

## Riscos e decisões

- A Fase 2 entrega Central de Mensagens do terapeuta com área separada “Suporte TES”, formulário de chamado, lista e detalhe de thread. A experiência do paciente permanece fora do escopo desta fase.
- `message_templates` agora é a fonte server-side para os seis templates de participante. A Fase 4 deverá definir gestão/versionamento do catálogo antes de qualquer expansão.
- Não houve mudança em e-mail, Stripe, Zoom, booking ou UI ampla.

> Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES, o TES controla o acesso — não a conversa.
