# Fase 2.5 — QA e Qualificação do Suporte

Data: 2026-08-21  
Ambiente: HML (`Terapeuta-Eu-Sou-Homolog`)  
Status: PASS

## Deploy coordenado

Foram aplicadas exclusivamente em HML, sem seeds, roles, Vault ou produção:

1. `20260821210644_harden_structured_participant_messaging.sql`;
2. `20260821213315_therapist_support_ticket_threads.sql`;
3. `20260821224500_admin_support_thread_read.sql`.

O preflight remoto confirmou a terceira como a única migration pendente. A
listagem posterior confirmou o histórico alinhado. O runtime foi publicado na
branch `homolog`; produção não recebeu alteração.

## E2E multi-persona — PASS

BrowserContexts independentes validaram o cenário autenticado em HML:

1. Terapeuta abre chamado com categoria controlada, assunto e descrição plain
   text; recebe protocolo e estado `open`.
2. Admin abre o mesmo ticket, lê a thread autorizada e responde publicamente.
3. Terapeuta vê a resposta e o estado `waiting_requester`, então responde.
4. Admin recarrega e vê a resposta subsequente do terapeuta na mesma thread.
5. Admin registra nota interna; ela é exibida somente à equipe TES.
6. Terapeuta recarrega: a nota interna não aparece no DTO nem na tela.
7. Admin resolve; terapeuta vê `resolved` e usa **Ainda preciso de ajuda**.
8. A resposta de reabertura retorna o ticket a `waiting_support` e o Admin a
   visualiza.

O smoke de autenticação de paciente, terapeuta e Admin também passou em
BrowserContexts separados. Tickets QA foram mantidos em HML para rastreabilidade.

## Lifecycle no backend — PASS

O E2E confirmou por `GET /api/support/tickets/[ticketId]` na sessão do
solicitante:

| Etapa                     | Estado              | Mensagens públicas |
| ------------------------- | ------------------- | ------------------ |
| Criação                   | `open`              | 1                  |
| Resposta pública do Admin | `waiting_requester` | 2                  |
| Resposta do terapeuta     | `waiting_support`   | 3                  |
| Resolução administrativa  | `resolved`          | 3                  |
| Reabertura pelo terapeuta | `waiting_support`   | 4                  |

A nota interna não alterou a contagem pública devolvida ao terapeuta.

## Segurança — PASS

- `GET /api/admin/support/tickets/:ticketId/thread` chama apenas a RPC
  Admin-only `admin_get_support_ticket_thread_v1` e exige `admin.support.read`.
- `POST /api/admin/support/tickets/:ticketId/notes` exige
  `admin.support.manage`; a nota usa `visibility=internal`.
- O solicitante continua recebendo somente mensagens `requester` do próprio
  ticket. A prova HML criou nota interna real e confirmou sua ausência na tela
  e na API do terapeuta.
- A rota HML `/api/messages/send-template` recusou uma requisição autenticada
  contendo `body` com `422`, antes de persistir:
  **PARTICIPANT FREE TEXT BYPASS = BLOCKED**.
- O isolamento de terapeuta B contra ticket A permanece coberto no pgTAP
  `069_support_ticket_threads.sql`. Não foi disponibilizada uma segunda conta
  terapeuta QA para repetir essa mesma prova em HML.

## Responsividade — PASS

O Playwright validou desktop (`1440px`), tablet (`768px`) e mobile (`390px`):
Central, detalhe, scroll até o composer, foco do textarea e ausência de
overflow horizontal. Capturas com identidade QA não foram publicadas. O
teclado virtual nativo não é exposto pelo Chromium headless; o composer foi
validado em foco e em reflow mobile.

## Validação e limitações de tooling

- `npm run typecheck`, `npm run lint`, `npm run build`, Vitest focal e
  `git diff --check`: passaram.
- O Docker/Supabase local ficou indisponível nesta máquina com `EOF`; por isso
  o pgTAP focal atualizado não foi reexecutado após a última migration. A
  migration e a RPC foram, porém, exercidas com sucesso pelo E2E real de HML.
- Nenhum e-mail, pagamento, Zoom ou dado de produção foi alterado.

## Resultado

**PHASE 2.5 — PASS**

**PHASE 2 — PASS**

**PHASE 3 READY**

O terapeuta explica livremente um problema à equipe TES e mantém uma conversa
dentro do chamado: **SIM**.

Um terapeuta usa essa infraestrutura para escrever livremente a um paciente:
**NÃO**.
