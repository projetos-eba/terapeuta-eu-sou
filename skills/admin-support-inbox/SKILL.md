# Admin Support Inbox

## Escopo

Página administrativa canônica: `/admin/suporte`. Serve para triagem,
contexto, atendimento e resolução de tickets; não é um dashboard analítico nem
uma segunda implementação da thread.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/support/support-and-messaging-contracts.md`
- `docs/architecture/adr/ADR-016-support-vs-participant-messaging.md`
- `docs/support/phase-2-therapist-support-report.md`
- `docs/support/phase-3-admin-support-inbox-report.md`
- `docs/design-system/{experience-principles,density,design-system,composition-patterns,interaction-patterns}.md`

## Dados e segurança

- Listagem: `admin_get_support_inbox_v1(jsonb)`; nunca montar busca client-side
  sobre uma página parcial.
- Detalhe usa a thread Admin-only existente. Notas internas jamais entram em
  endpoints, DTOs ou queries do solicitante.
- Triagem usa `admin_manage_support_ticket_v1`; `auth.uid()` define o Admin
  responsável. O browser não escolhe requester, autor ou outro Admin.
- Ações permitidas: `assign_self`, `unassign`, `set_priority`, `start`,
  `resolve`, `reopen`. Mudanças são auditadas.
- `waiting_support` significa que TES precisa agir e deve ter prioridade visual, sem alterar a ordenação padrão por recência.
- Respostas públicas do Admin podem incluir anexos privados; a verificação de
  idempotência deve usar o contrato administrativo, sem consultar a tabela de
  mensagens diretamente sob RLS.
- `waiting_requester` organiza a fila, mas não bloqueia o Admin: a equipe pode
  enviar complementos e anexos consecutivos sem aguardar uma nova mensagem do
  solicitante. Tickets resolvidos continuam exigindo reabertura explícita.
- Exibir o protocolo persistido, nunca UUID: nove dígitos e a letra da categoria. A busca por protocolo é resolvida somente na RPC administrativa.
- Os estados Admin são “Novo chamado”, “Em atendimento”, “Aguardando resposta da equipe TES”, “Aguardando resposta do solicitante” e “Resolvido”.
- Lista, detalhe, triagem e conversa usam SSE mediado pelo servidor; a Inbox relê pelo evento de `support_tickets` e ordena por `last_activity_at DESC`, `created_at DESC`, `id DESC`. Quando ele cair, o polling é temporário e a reconexão usa espera progressiva.

## UX

- Desktop: EntityList/OperationalTable legível, filtros antes da lista e
  detalhe em rota dedicada.
- Tablet/mobile: lista vira itens estruturados; detalhe é página, thread e
  composer permanecem em uma coluna; não comprimir tabela.
- Diferenciar empty real de filtro sem resultados.
- Resposta pública e nota interna devem ter título e CTA explícitos, não apenas
  cor. Conteúdo é plain text sem `dangerouslySetInnerHTML`.

## QA

- Testar URL filters, busca, paginação e ordenação por atividade mais recente primeiro, inclusive desempates estáveis.
- Testar atribuição, prioridade, transições válidas/inválidas e audit.
- Testar que resposta pública, nota interna e triagem atualizam cabeçalho, status e conversa sem recarregar manualmente.
- Testar duas respostas públicas consecutivas do Admin, incluindo uma com
  anexo, enquanto o chamado permanece em `waiting_requester`.
- Repetir isolamento requester/internal note e `PARTICIPANT FREE TEXT BYPASS = BLOCKED`.
- Antes de HML, conferir migrations Fase 1, Fase 2, `20260821224500` e Fase 3.
