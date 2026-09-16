# Contratos de Suporte TES — transição da Central de Mensagens

Data: 2026-08-21  
Status: Support Ticketing ativo; Structured Participant Messaging V2 encerrado
em 2026-09-15 pela ADR-021. Os parágrafos de Fases 1–4 abaixo registram o
contrato histórico e não autorizam reativação.

## Contrato vigente desde 2026-09-15

- `/app/suporte`, `/terapeuta/suporte` e detalhes
  `/app/suporte/:ticketId`, `/terapeuta/suporte/:ticketId` são canônicos.
  Rotas antigas em `/mensagens` redirecionam permanentemente.
- Usuários escrevem somente em tickets próprios à equipe TES. Protocolos,
  anexos, respostas públicas e notas internas preservam as políticas de
  visibilidade já documentadas abaixo.
- `conversations` e `messages` são histórico somente leitura;
  `POST /api/messages/preview-template` e
  `POST /api/messages/send-template` respondem `410`. O badge mostra
  chamados não resolvidos.
- Aviso de atraso e alteração de sessão pertencem ao booking, não à thread.
  WhatsApp TES é assistência operacional apenas na preparação e sala Zoom.
- `source=message_center` permanece no contrato técnico de criação de
  tickets por compatibilidade com a constraint; não é copy de interface.
- Alteração iniciada pela terapeuta é uma decisão de 48 horas no próprio
  booking: a pessoa escolhe um novo horário autoritativo do mesmo profissional
  ou solicita reembolso integral. Cancelamento sem solução, horário original
  já passado ou pedido de reembolso movem o caso para `pending_admin_review`;
  sala, falta e repasse ficam bloqueados sem qualquer mutação Stripe automática.
  A fila financeira Admin identifica o caso como “Reembolso em análise”, sem
  incluir conteúdo de mensagens ou identificadores de provedores de pagamento.

## Estado real inventariado

| Superfície    | Contrato atual                                                                               | Observação da Fase 1                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Participante  | `conversations`, `messages`, `message_templates` históricos e endpoints `/api/messages/*` encerrados | Histórico somente leitura; preview e envio retornam `410`, sem nova escrita por participante. |
| Suporte       | `support_tickets`, `support_ticket_messages`, APIs `/api/support/tickets*`                   | Ticket e thread plain text para terapeuta, com idempotência, RLS por solicitante e contexto opcional autorizado.                |
| Administração | `/admin/suporte`, thread Admin, notas internas e comandos `support.resolve`/`support.reopen` | Pode ler a thread autorizada, responder publicamente e registrar nota interna sem expô-la ao solicitante.                       |
| Legado        | `structured_messages`                                                                        | Não identificado consumidor no runtime analisado. A tabela permanece por compatibilidade e não deve ser fundida com `messages`. |

O histórico de migrations local e de HML foi conferido em modo somente leitura e estava alinhado. O Supabase MCP não estava disponível nesta sessão.

## Bounded contexts e invariantes

### Histórico de mensagens entre participantes — encerrado

`conversations`, `messages` e `message_templates` são preservados para leitura
histórica e auditoria. A Central, shells, rotas Next e RPCs não podem oferecer
lista, contador, template, prévia, composer ou envio entre paciente e terapeuta.
Operações da sessão usam `booking_events`, `booking_reschedule_requests` e
notificações unilaterais; atendimento humano usa tickets TES.

### Support Ticketing

Suporte é a relação entre o solicitante e o TES. Texto livre é permitido somente dentro de ticket autorizado; nunca reutiliza a API, tabela ou UI de mensagens entre participantes.

- Paciente e terapeuta abrem e leem somente tickets próprios.
- Depois de uma resposta pública do solicitante, o ticket fica em
  `waiting_support`: a mensagem já foi recebida e a fila do TES recebe
  prioridade. Esse estado não bloqueia a conversa: o solicitante pode enviar
  complementos e anexos no mesmo ticket enquanto aguarda atendimento.
- Cada ticket recebe um protocolo persistido e imutável no formato `#582914730P`: nove dígitos e uma letra da categoria. As letras são `A` (agenda e sessões), `Z` (acesso à sala), `P` (pagamentos), `F` (financeiro), `S` (plano), `V` (perfil e verificação), `C` (conta e acesso) e `O` (outro). O protocolo identifica o atendimento; autorização continua baseada no ticket e na sessão autenticada.
- `requester_profile_id` e papel são derivados da sessão; o navegador não pode escolher outro solicitante.
- `booking_id`, quando aceito, precisa pertencer ao solicitante segundo a relação canônica de booking.
- Conteúdo é plain text, sem interpretação HTML ou Markdown e sem conteúdo em logs operacionais.
- Anexos do suporte são opcionais e privados: até 5 arquivos por resposta, com
  até 10 MB por arquivo, nos formatos PDF, JPG, PNG ou WebP. O navegador
  informa esses limites, mas a API, o Storage e a RPC validam novamente o
  contrato. O binário não passa pela Route Handler: após autorização autenticada
  por ticket e `requestId`, cada arquivo usa uma URL de upload temporária e vai
  diretamente ao bucket privado. A confirmação continua no servidor/RPC e só
  então o anexo integra a mensagem.
- E-mail é uma notificação futura; a thread autenticada será a fonte canônica.

## Matriz de autorização

| Capacidade                             | Paciente                 | Terapeuta                | Admin autorizado                |
| -------------------------------------- | ------------------------ | ------------------------ | ------------------------------- |
| Enviar template ao outro participante  | Não                      | Não                      | Fora do escopo                  |
| Texto livre ao outro participante      | Não                      | Não                      | Não                             |
| Abrir ticket próprio                   | Sim                      | Sim                      | Conforme operação               |
| Texto livre em ticket próprio (Fase 2) | Sim                      | Sim                      | Sim                             |
| Ler ticket de outro solicitante        | Não                      | Não                      | Sim, com `admin.support.manage` |
| Criar/ler nota interna                 | Não                      | Não                      | Sim, com `admin.support.manage` |
| Atribuir, priorizar, resolver, reabrir | Não                      | Não                      | Sim, com `admin.support.manage` |

## Contratos de API

### Envio estruturado V2 — contrato histórico, endpoints encerrados

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

`POST /api/messages/preview-template` e `POST /api/messages/send-template`
respondem `410` com um estado de produto para canal encerrado. As RPCs de
mensagem não recebem novos grants para perfis autenticados. Não há sucesso de
envio, prévia ou fallback de template nesta fase.

### Criação de suporte vigente

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
- `POST /api/support/tickets/:ticketId/attachments`: etapa autenticada interna
  de preparar, concluir ou limpar uploads diretos privados; aceita somente
  metadados limitados e paths temporários gerados para o mesmo ticket e
  `requestId`, nunca o binário. Em uma seleção múltipla, a autorização e o
  upload ocorrem na ordem escolhida, um arquivo por vez; se algum falhar, a
  limpeza remove apenas os arquivos já enviados antes de informar a falha;
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

Na resposta do solicitante, `422` informa payload ou anexo fora do contrato e
`429` informa limite temporário de frequência. `waiting_support` não é motivo
para rejeitar um novo complemento. O cliente não deve transformar esses estados
em um erro genérico.

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

Nota interna, alteração de prioridade e atribuição atualizam `last_activity_at`, mas não podem expor conteúdo ou autor administrativo ao solicitante. Admin só pode iniciar atendimento a partir de `open` ou `waiting_support`; resposta pública é aceita em `open`, `in_progress`, `waiting_support` ou `waiting_requester`, para que uma conversa não fique travada depois de uma resposta da equipe. Resolução exige ticket ainda não resolvido; reabertura administrativa exige `resolved`.

## Leitura e paginação da Central

A Central vigente pagina somente chamados por `supportPage`, apresenta
avisos da plataforma em seção própria e não consulta conversas de
participantes. `conversationPage`, ponto de mensagem não lida e RPC de
marcação de mensagens pertencem exclusivamente ao histórico anterior.

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

- A central de suporte atende paciente e terapeuta com as mesmas rotas
  canônicas por área autenticada. A interface não depende de `message_templates`.
- O reembolso por alteração iniciada pela terapeuta só é disparado pela decisão
  explícita de Admin e preserva a ordem Transfer Reversal antes de Refund.
- O upload de anexos de suporte não atravessa mais a Function do Next. Isso
  preserva o contrato de até cinco arquivos de 10 MB mesmo quando a hospedagem
  impõe limite agregado menor para o corpo de uma requisição HTTP.

> Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES, o TES controla o acesso — não a conversa.
