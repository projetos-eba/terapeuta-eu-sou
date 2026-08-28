# Contratos de Mensagens e Suporte — TES

Data: 2026-08-21  
Status: Fase 4 implementada; Structured Participant Messaging V2 e Support
Ticketing permanecem bounded contexts separados.

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
- `message_templates` também guarda `category`, `usage_description`,
  `parameter_schema`, `requires_booking` e `cta_action`. A descrição orienta
  apenas a UI; parâmetros são opções fechadas; CTAs são transformados pelo
  banco em rotas TES conforme o papel do destinatário.

### Support Ticketing

Suporte é a relação entre o solicitante e o TES. Texto livre é permitido somente dentro de ticket autorizado; nunca reutiliza a API, tabela ou UI de mensagens entre participantes.

- Paciente e terapeuta abrem e leem somente tickets próprios.
- Cada ticket recebe um protocolo persistido e imutável no formato `#582914730P`: nove dígitos e uma letra da categoria. As letras são `A` (agenda e sessões), `Z` (acesso à sala), `P` (pagamentos), `F` (financeiro), `S` (plano), `V` (perfil e verificação), `C` (conta e acesso) e `O` (outro). O protocolo identifica o atendimento; autorização continua baseada no ticket e na sessão autenticada.
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

### Envio estruturado V2 vigente

`POST /api/messages/send-template`

```json
{
  "actorRole": "patient",
  "conversationId": "uuid",
  "bookingId": "uuid-opcional",
  "templateKey": "patient_confirm_session",
  "parameters": {}
}
```

`POST /api/messages/preview-template` usa o mesmo payload e devolve somente o
conteúdo resolvido, destinatário, contexto e CTA canônico; não persiste. O
`POST /api/messages/send-template` usa a RPC
`send_structured_participant_message_v2(uuid, text, uuid, jsonb)`. A RPC deriva
`auth.uid()`, valida ownership da conversa, sentido do template, booking,
parâmetros fechados e CTA allowlisted; só então persiste `body`, `template_id`
e metadata resolvidos. `body`, `message`, `description`, `html`, URL e qualquer
campo desconhecido são rejeitados na borda HTTP e nunca chegam à persistência.
`send_structured_participant_message_v1` permanece como wrapper compatível que
delegará à V2.

Os seis templates originais preservam envio em conversas legadas sem
`booking_id`; nesse caso não há CTA. Os templates novos exigem contexto de
booking quando o fluxo precisa de uma ação de sessão.

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
  `admin.support.manage`;
- `GET /api/admin/support/tickets/:ticketId/management`: metadados de triagem
  exclusivamente administrativos;
- `POST /api/admin/support/tickets/:ticketId/management`: ações allowlisted
  `assign_self`, `unassign`, `set_priority`, `start`, `resolve` e `reopen`,
  todas derivadas de `auth.uid()` e auditadas.

### Inbox administrativa — Fase 3

`/admin/suporte` usa exclusivamente `admin_get_support_inbox_v1(jsonb)`. O
read model aceita busca limitada por protocolo, assunto, nome e e-mail do
solicitante, filtros de status, prioridade, categoria, persona e atribuição
(`me`/`unassigned`) e paginação de no máximo 50 itens. A busca por e-mail é
executada somente dentro da RPC Admin-only e o e-mail não entra no DTO da
listagem.

A ordenação autoritativa da Inbox é `last_activity_at DESC`, `created_at DESC`
e `id DESC`. Portanto, uma abertura, resposta, nota ou decisão mais recente
retorna o chamado ao topo; status e prioridade continuam disponíveis para
filtro e `waiting_support` recebe destaque visual, mas não reordena a lista.
`assigned_admin_id` é aditivo em `support_tickets`, tem uso operacional real e
nunca entra em DTO/RLS do solicitante.

As telas de suporte atualizam por SSE mediado pelo servidor. Ao perder a conexão,
usam atualização periódica temporária e tentam reconectar com espera progressiva;
ao recuperar o canal, o polling para. O retorno para uma aba visível força uma
atualização imediata. O navegador recebe somente um sinal de atualização, nunca
mensagens internas, dados de outros tickets ou credenciais.

No detalhe, o SSE observa `support_tickets.id`, as mensagens por `ticket_id` e
seus anexos por `ticket_id`. Na lista de paciente/terapeuta, observa somente os
próprios `support_tickets` por `requester_profile_id`; a alteração de
`last_activity_at` é o sinal autoritativo para reler e ordenar. A Central de
Mensagens mantém a assinatura separada de `messages` para conversas estruturadas
entre participantes.

## Lifecycle de suporte vigente

| Evento autorizado                     | Estado resultante   | `waiting_on` | Efeito                                                 |
| ------------------------------------- | ------------------- | ------------ | ------------------------------------------------------ |
| Criação                               | `open`              | `support`    | `last_activity_at` recebe criação; `resolved_at` nulo. |
| Admin assume ou trabalha internamente | `in_progress`       | `support`    | Atualiza atividade.                                    |
| Admin envia resposta pública          | `waiting_requester` | `requester`  | Atualiza atividade.                                    |
| Solicitante envia mensagem pública    | `waiting_support`   | `support`    | Atualiza atividade; reabre ticket resolvido.           |
| Admin resolve                         | `resolved`          | nulo         | Define `resolved_at` e atualiza atividade.             |
| Admin reabre                          | `open`              | `support`    | Limpa `resolved_at` e atualiza atividade.              |

Copy dos estados: para solicitante, `open` é “Recebemos seu chamado”,
`in_progress` é “Em atendimento pelo TES”, `waiting_support` é “Aguardando
resposta do TES”, `waiting_requester` é “Aguardando sua resposta” e `resolved`
é “Resolvido”. Para Admin, os mesmos estados explicam a fila: “Novo chamado”,
“Em atendimento”, “Aguardando resposta da equipe TES”, “Aguardando resposta do
solicitante” e “Resolvido”.

Nota interna, alteração de prioridade e atribuição atualizam `last_activity_at`, mas não podem expor conteúdo ou autor administrativo ao solicitante. Admin só pode iniciar atendimento a partir de `open` ou `waiting_support`; resposta pública só é aceita em `open`, `in_progress` ou `waiting_support`; resolução exige ticket ainda não resolvido; reabertura administrativa exige `resolved`.

## Leitura e paginação da Central

As conversas estruturadas de participante e os chamados do solicitante são
listas independentes, paginadas em blocos de 10 na rota de Central (`conversationPage`
e `supportPage`). Cada controle preserva a página da outra lista. Uma conversa
com mensagens recebidas não lidas mostra ponto vermelho; ao ser aberta, a rota
autenticada chama `mark_structured_participant_messages_read_v1(uuid)`, que
valida a participação e atualiza apenas mensagens de terceiros. Depois da
confirmação, o ponto e o contador são atualizados imediatamente e a página é
revalidada.

## Dados, RLS e compatibilidade da Fase 2

`support_ticket_messages` contém `id`, `ticket_id`, `author_profile_id` derivado, papel do autor, `body`, `visibility` (`requester` ou `internal`), `created_at` e `request_id`. A constraint `(ticket_id, author_profile_id, request_id)` bloqueia retries duplicados. A descrição inicial nova é materializada como primeira mensagem pública, portanto a thread é a fonte canônica da conversa. Tickets históricos sem thread retornam a descrição legada como primeira mensagem conceitual, sem backfill destrutivo. A migration de protocolos preenche chamados existentes antes de tornar `support_tickets.protocol` obrigatório e único.

Campos de `support_tickets` só serão adicionados com uso: `assigned_admin_id`, `last_activity_at` e `resolved_at`. `waiting_on` continua redundante com o estado e não existe. A migration da Fase 3 adiciona somente `assigned_admin_id`, índices de Inbox e boundaries Admin-only; registros atuais permanecem compatíveis. Os comandos legados `support.resolve`/`support.reopen` agora delegam à mesma state machine da Inbox.

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
