# TES — Contexto de Produto e Arquitetura
## Evolução de Mensagens e Suporte

**Projeto:** Terapeuta Eu Sou (TES)  
**Repositório:** `projetos-eba/terapeuta-eu-sou`  
**Snapshot de contexto:** 21/08/2026  
**Objetivo deste documento:** fornecer contexto durável para agentes de IA que irão trabalhar na evolução de **Mensagens** e **Suporte** sem perder as regras de produto, segurança e arquitetura definidas.

---

# 1. Visão executiva

O TES possui hoje uma Central de Mensagens que atende dois casos de uso diferentes:

1. comunicação entre **cliente/paciente e terapeuta**;
2. comunicação entre **usuário e suporte da plataforma TES**.

Esses dois fluxos não devem compartilhar a mesma regra de comunicação.

A decisão de produto é:

> **Paciente ↔ terapeuta = comunicação estruturada e controlada por templates, sem texto livre.**

> **Usuário ↔ Suporte TES = atendimento real, com texto livre, protocolo, thread de atendimento e gestão administrativa.**

Essa separação deve existir em:

- UX/UI;
- contratos de API;
- tipos;
- banco de dados;
- políticas RLS;
- DTOs;
- eventos;
- testes;
- permissões;
- trilha de auditoria.

O principal risco a ser evitado é permitir que a evolução do suporte abra, direta ou indiretamente, uma forma de chat livre entre terapeuta e cliente.

---

# 2. Princípios de produto

## 2.1. Comunicação paciente ↔ terapeuta

A comunicação entre paciente e terapeuta é **estruturada**.

Regras invariantes:

- não existe textarea para mensagem livre;
- paciente não digita mensagem personalizada para terapeuta;
- terapeuta não digita mensagem personalizada para paciente;
- o cliente não pode alterar o texto de um template;
- o terapeuta não pode alterar o texto de um template;
- o frontend não decide o corpo final da mensagem;
- a API recebe uma referência segura, como `templateKey`;
- o backend resolve o conteúdo autorizado;
- o banco nunca deve receber um `body` arbitrário vindo do cliente nesse fluxo;
- complementos, quando existirem, devem ser estruturados e fechados;
- um template não deve substituir uma operação canônica do produto.

Exemplos:

- reagendamento deve continuar acontecendo no fluxo de reagendamento;
- cancelamento deve continuar acontecendo no fluxo de cancelamento;
- o template apenas comunica ou orienta o próximo passo.

### Regra de ouro

> Se uma informação enviada ao outro participante puder ser digitada livremente, a fronteira de segurança foi quebrada.

---

## 2.2. Comunicação usuário ↔ Suporte TES

O suporte é um relacionamento entre o usuário e a própria plataforma.

Aqui, texto livre é desejado e necessário.

O usuário deve poder:

- selecionar uma categoria;
- explicar o problema em linguagem natural;
- vincular contexto quando aplicável;
- receber protocolo;
- acompanhar o chamado;
- receber respostas;
- responder ao suporte;
- visualizar status e última atividade;
- reabrir quando permitido.

O Admin deve poder:

- visualizar a fila de atendimento;
- abrir um ticket;
- responder ao solicitante;
- adicionar nota interna;
- atribuir responsável;
- alterar prioridade;
- alterar estado;
- resolver;
- reabrir;
- acessar contexto operacional mínimo necessário;
- visualizar trilha de auditoria.

### Regra de ouro

> Entre usuário e TES, a plataforma controla o acesso e a autorização — não o conteúdo da conversa.

---

# 3. Estado atual relevante no repositório

Os caminhos abaixo devem ser inspecionados novamente pelo agente antes de qualquer alteração, pois este documento registra um snapshot e não substitui o código real.

## 3.1. Templates

Arquivo atual:

`src/features/message-center/message-center.templates.ts`

No snapshot atual existem templates separados para:

- terapeuta → paciente;
- paciente → terapeuta;
- paciente → suporte;
- terapeuta → suporte.

Os templates atuais são simples e usam essencialmente:

- `key`;
- `label`;
- `category`;
- `body`.

Exemplos atuais de terapeuta → paciente:

- confirmar sessão;
- orientação pré-sessão;
- receber reagendamento.

Exemplos atuais de terapeuta → suporte:

- financeiro;
- agenda e sessões;
- conta profissional.

---

## 3.2. Ações da Central de Mensagens

Arquivo atual:

`src/features/message-center/components/message-center-actions.tsx`

O componente atende atualmente tanto:

- `variant="participant"`;
- `variant="support"`.

No fluxo de suporte atual, o usuário escolhe um template/categoria e não escreve texto livre.

No fluxo de participante, o usuário escolhe destinatário/conversa e um template aprovado.

Essa reutilização é funcional para o MVP, mas não deve determinar o desenho final do domínio.

---

## 3.3. Envio de mensagem estruturada

Endpoint atual:

`src/app/api/messages/send-template/route.ts`

A arquitetura atual possui uma característica importante que deve ser preservada:

- o cliente envia `actorRole`, `conversationId` e `templateKey`;
- o servidor busca o template permitido;
- o servidor grava o `body` aprovado;
- o cliente não determina o conteúdo final da mensagem.

Esse é o padrão de segurança correto para paciente ↔ terapeuta.

---

## 3.4. Abertura de chamado

Endpoint atual:

`src/app/api/support/tickets/route.ts`

O endpoint atual:

- autentica paciente ou terapeuta;
- valida `requestId`;
- aceita `bookingId` opcional;
- valida acesso ao booking;
- resolve a categoria por `templateKey`;
- cria `support_tickets`;
- usa idempotência por solicitante + `request_id`;
- grava `correlation_id`;
- grava `diagnostic_context`;
- grava `source`;
- define prioridade/urgência;
- devolve protocolo derivado do ticket.

Hoje `subject` e `description` são derivados do template de suporte.

A evolução desejada é permitir descrição livre no domínio de suporte sem alterar a regra do domínio de participante.

---

## 3.5. Banco atual

A base já possui `support_tickets`.

Campos observados ao longo das migrations incluem, entre outros:

- `id`;
- `requester_profile_id`;
- `booking_id`;
- `category`;
- `subject`;
- `description`;
- `status`;
- `priority`;
- `request_id`;
- `correlation_id`;
- `diagnostic_context`;
- `source`;
- `urgency`;
- `created_at`;
- `updated_at`.

Existem também fundamentos de idempotência, índices e RLS.

O agente deve verificar o schema real e todas as migrations antes de propor alterações.

---

## 3.6. Admin — detalhe de suporte

Arquivo atual:

`src/features/admin-operations/components/admin-support-detail-page.tsx`

A tela já possui fundamentos úteis:

- identidade do chamado;
- prioridade;
- urgência;
- categoria;
- origem;
- solicitante;
- perfil do solicitante;
- booking relacionado;
- rastreabilidade;
- histórico administrativo;
- ações administrativas.

A evolução deve aproveitar essa base em vez de substituí-la sem necessidade.

---

## 3.7. Admin — comandos

Arquivo atual:

`src/features/admin-operations/components/admin-operation-command-panel.tsx`

No snapshot atual o suporte possui ações como:

- `support.resolve`;
- `support.reopen`.

Ainda não há, nesse contrato, recursos de:

- resposta ao solicitante;
- nota interna;
- atribuição;
- waiting-on;
- thread de mensagens.

---

# 4. Arquitetura-alvo

O produto deve evoluir para dois bounded contexts claros.

---

## 4.1. Structured Participant Messaging

Responsável por:

- paciente → terapeuta;
- terapeuta → paciente.

### Entrada autorizada

Preferencialmente:

- ator;
- conversa/contexto;
- `templateKey`;
- campos estruturados explicitamente permitidos.

### Entrada proibida

- `body` arbitrário;
- `message` arbitrária;
- `description` livre destinada ao participante;
- HTML;
- markdown livre;
- anexos livres, enquanto não existir contrato explícito.

### Saída

Mensagem renderizada pelo servidor a partir de conteúdo aprovado.

---

## 4.2. Support Ticketing

Responsável por:

- paciente → TES;
- terapeuta → TES;
- Admin/TES → solicitante.

### Conceitos esperados

- ticket;
- requester;
- categoria;
- assunto;
- descrição inicial;
- contexto relacionado;
- prioridade;
- urgência;
- responsável;
- estado;
- thread;
- mensagem pública;
- nota interna;
- última atividade;
- resolução;
- reabertura;
- auditoria.

---

# 5. Lifecycle desejado para Suporte

O agente deve validar compatibilidade com os estados já existentes antes de mudar o banco.

Modelo de produto recomendado:

- `open` — criado e ainda não assumido;
- `in_progress` — suporte trabalhando;
- `waiting_requester` — depende de resposta do usuário;
- `waiting_support` — usuário respondeu e aguarda TES;
- `resolved` — concluído.

Reabertura pode ser:

- transição de `resolved` para `open` ou `in_progress`;

ou, se houver necessidade real:

- estado explícito de `reopened`.

Evitar explosão de estados sem ganho operacional.

### Pergunta que o estado deve responder

> Quem precisa agir agora?

---

# 6. Modelo conceitual de mensagens de suporte

A evolução natural do schema é uma entidade equivalente a:

`support_ticket_messages`

Contrato conceitual esperado:

- `id`;
- `ticket_id`;
- `author_profile_id`;
- papel/tipo do autor;
- `body`;
- `visibility`;
- `created_at`;
- metadata mínima quando necessária.

### Visibilidade

Pelo menos dois níveis:

- `requester` / público no ticket;
- `internal` / somente operação TES.

Nota interna nunca pode aparecer no DTO do solicitante.

---

# 7. Evoluções prováveis de support_tickets

O agente deve confirmar necessidade antes de criar campos.

Candidatos:

- `assigned_admin_id`;
- `last_activity_at`;
- `resolved_at`;
- `waiting_on` ou equivalente;
- SLA futuramente, se houver requisito real.

Não adicionar campos especulativos sem uso definido.

---

# 8. Contexto automático

Suporte deve aproveitar contexto que o TES já conhece.

Exemplos:

### Sessão

Ao abrir suporte a partir de uma sessão:

- `booking_id`;
- status do booking;
- horário;
- payment state;
- video session state;
- origem do fluxo.

O usuário não deve precisar copiar IDs técnicos.

### Financeiro

Futuramente, um chamado iniciado em um repasse pode carregar a referência canônica daquele repasse.

### Assinatura

Futuramente, pode carregar o plano/subscription relacionado.

### Regra de privacidade

Contexto automático deve ser:

- mínimo;
- relevante;
- autorizado;
- auditável.

Não transformar `diagnostic_context` em depósito indiscriminado de dados.

---

# 9. Templates V2 de participante

A biblioteca deve evoluir sem abrir texto livre.

Um template V2 pode ter:

- `key`;
- `label`;
- descrição de uso;
- `category`;
- `body`;
- ator permitido;
- destinatário permitido;
- contexto permitido;
- CTA controlado;
- parâmetros fechados;
- estado ativo/inativo;
- versão, se necessário.

Exemplos de categorias úteis:

### Terapeuta → paciente

- confirmação;
- preparação;
- presença/sala;
- pequeno atraso;
- dificuldade técnica;
- reagendamento;
- cancelamento;
- orientação para ação no TES.

### Paciente → terapeuta

- confirmação de presença;
- dificuldade de acesso;
- reagendamento;
- cancelamento;
- dúvida operacional.

A lista final deve respeitar fluxos canônicos do produto.

---

# 10. Matriz de permissões desejada

| Capacidade | Paciente | Terapeuta | Admin |
|---|---:|---:|---:|
| Enviar template a participante autorizado | Sim | Sim | Não é o foco |
| Digitar mensagem livre para outro participante | Não | Não | Não |
| Abrir ticket de suporte | Sim | Sim | Pode criar/operar conforme contrato |
| Escrever descrição livre no suporte | Sim | Sim | Sim |
| Responder thread de suporte própria | Sim | Sim | Sim |
| Ler ticket de outro usuário | Não | Não | Sim, se autorizado como Admin |
| Criar nota interna | Não | Não | Sim |
| Ler nota interna | Não | Não | Sim |
| Alterar prioridade | Não | Não | Sim |
| Atribuir responsável | Não | Não | Sim |
| Resolver/reabrir | Limitado ao contrato | Limitado ao contrato | Sim |

Essa matriz deve ser refletida em RLS, API e DTOs, não apenas na UI.

---

# 11. Contratos de API — princípios

## 11.1. Participant messaging

A API deve continuar server-authoritative.

Exemplo conceitual:

`POST /api/messages/send-template`

Payload:

```json
{
  "actorRole": "therapist",
  "conversationId": "uuid",
  "templateKey": "therapist_confirm_session"
}
```

O servidor:

1. autentica;
2. valida o papel;
3. valida acesso à conversa;
4. valida que o template pode ser usado naquele sentido;
5. resolve o corpo;
6. grava a mensagem.

Nunca confiar em `body` enviado pelo browser.

---

## 11.2. Support ticket creation

Contrato futuro esperado, a validar:

`POST /api/support/tickets`

Payload conceitual:

```json
{
  "actorRole": "therapist",
  "requestId": "uuid",
  "category": "financeiro",
  "subject": "Dúvida sobre repasse",
  "description": "Descrição livre do problema...",
  "bookingId": null,
  "source": "message_center"
}
```

A categoria pode continuar vindo de uma taxonomia controlada.

A descrição pode ser livre.

O assunto pode ser:

- controlado;
- sugerido;
- ou livre com limite curto.

Essa decisão deve ser formalizada na Fase 1.

---

## 11.3. Support thread

Contrato futuro provável:

- listar ticket próprio;
- obter detalhe;
- enviar mensagem;
- marcar visualização;
- Admin responder;
- Admin criar nota interna;
- alterar status;
- atribuir.

A Fase 1 deve definir os contratos antes da construção de UI completa.

---

# 12. Segurança e RLS

Requisitos obrigatórios:

1. paciente só lê tickets próprios;
2. terapeuta só lê tickets próprios;
3. participante não lê nota interna;
4. Admin autorizado consegue operar os tickets;
5. uma mensagem de suporte não pode ser inserida em ticket de outro solicitante;
6. `author_profile_id` deve ser derivado da identidade autenticada sempre que possível;
7. `requester_profile_id` não deve ser confiado cegamente do cliente;
8. IDs relacionados precisam ser autorizados;
9. participant messaging não aceita corpo arbitrário;
10. plain text deve ser o padrão inicial para suporte;
11. limites de tamanho precisam existir;
12. rate limiting deve ser considerado na camada adequada;
13. logs não devem armazenar conteúdo sensível sem necessidade;
14. toda nota interna deve ser impossível de serializar para o requester por padrão.

---

# 13. Auditoria

Separar dois conceitos:

## Conversa

- mensagens entre usuário e suporte.

## Histórico administrativo

- atribuição;
- alteração de prioridade;
- mudança de status;
- resolução;
- reabertura;
- ações operacionais.

Não misturar nota interna, conversa e auditoria em um único campo textual.

---

# 14. E-mail e notificações

O trabalho de e-mail do TES pode futuramente consumir eventos como:

- `support_ticket_created`;
- `support_admin_replied`;
- `support_requester_replied`;
- `support_ticket_resolved`;
- `support_ticket_reopened`.

Porém:

> e-mail é notificação; o ticket autenticado é a fonte canônica da conversa.

A Fase 1 não deve redesenhar o sistema de e-mails, salvo necessidade de contrato/evento.

---

# 15. Roadmap aprovado

## Fase 1 — Contratos

Objetivo:

- separar formalmente Structured Participant Messaging de Support Ticketing;
- inventariar schema, APIs e RLS;
- definir lifecycle;
- definir contratos;
- eliminar ambiguidades de segurança;
- preparar implementação subsequente.

## Fase 2 — Suporte do terapeuta

- novo chamado com categoria + descrição livre;
- Meus chamados;
- detalhe;
- respostas;
- contexto relacionado.

## Fase 3 — Admin Support Inbox

- fila;
- filtros;
- thread;
- resposta;
- nota interna;
- responsável;
- prioridade;
- status.

## Fase 4 — Mensagens estruturadas V2

- catálogo ampliado;
- descrição de uso;
- preview;
- contexto;
- CTAs;
- parâmetros estruturados.

## Fase 5 — Operação e QA

- notificações;
- e-mail;
- não lidos;
- RLS;
- rate limits;
- mobile;
- E2E multi-persona.

---

# 16. Escopo obrigatório da Fase 1

A Fase 1 deve produzir uma definição implementável e verificável.

Esperado:

1. inventário do estado real;
2. mapa de domínio;
3. contratos de dados;
4. contratos de API;
5. matriz de autorização;
6. lifecycle e transições;
7. estratégia de compatibilidade/migração;
8. riscos;
9. testes de contrato;
10. plano exato para a Fase 2.

A Fase 1 pode realizar pequenas alterações de código para corrigir uma quebra de fronteira ou formalizar tipos/validação, mas não deve antecipar toda a experiência de suporte.

---

# 17. Fora de escopo da Fase 1

Salvo correção de segurança indispensável:

- construir inbox completa do Admin;
- construir thread visual completa;
- implementar upload de anexos;
- implementar SLA;
- implementar chatbot;
- integrar ferramenta externa de help desk;
- refazer toda a Central de Mensagens;
- alterar fluxos de booking;
- alterar Stripe;
- alterar Zoom;
- alterar regras de cancelamento;
- liberar chat livre entre paciente e terapeuta;
- implementar e-mail completo de suporte.

---

# 18. Critérios de sucesso do programa

Ao final da evolução:

### Paciente ↔ terapeuta

- útil;
- rico;
- claro;
- protegido;
- zero texto livre.

### Usuário ↔ TES

- descritivo;
- rastreável;
- conversacional;
- com protocolo;
- com estado;
- operável pelo Admin.

### Admin

- entende quem solicitou;
- entende o contexto;
- sabe quem precisa agir;
- consegue responder;
- consegue registrar nota interna;
- consegue atribuir;
- consegue resolver;
- possui auditoria.

---

# 19. Frase de arquitetura

> **Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES, o TES controla o acesso — não a conversa.**

Toda decisão de implementação deve ser confrontada com essa frase.

---

# 20. Orientação para agentes

Antes de alterar código:

1. leia este documento;
2. inspecione o código atual;
3. inspecione migrations;
4. verifique tipos e APIs reais;
5. verifique RLS atual;
6. procure testes existentes;
7. identifique dependências com Admin, mensagens, notificações e e-mail;
8. documente divergências entre este snapshot e o estado atual;
9. preserve compatibilidade;
10. não faça mudanças destrutivas sem justificativa.

Quando houver conflito entre este documento e o código atual:

- trate a regra de produto como intenção;
- trate o código como estado real;
- documente a divergência;
- proponha a migração segura.

