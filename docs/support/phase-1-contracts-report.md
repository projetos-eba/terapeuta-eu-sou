# Relatório — Fase 1: Contratos de Mensagens e Suporte

Data: 2026-08-21

## Inventário realizado

- `conversations` e `messages` são o runtime participante; há RLS de leitura por participante, triggers de notificação e rota Next de envio.
- `message_templates` e `structured_messages` já existiam, mas não eram o boundary de escrita do runtime participante.
- `support_tickets` possui idempotência por solicitante + request, vínculo opcional a booking, prioridade, urgência, contexto mínimo, RLS de leitura do solicitante e comandos Admin de resolver/reabrir.
- `/admin/suporte` usa read models que minimizam descrição do ticket em lista e detalhe; ainda não há thread, nota interna, atribuição ou resposta pública.
- O trigger de notificações cobre nova mensagem participante, criação de ticket e atualização de status/resumo; não houve alteração de e-mail.

## Divergências encontradas

1. A rota de template resolvia o corpo corretamente, mas `authenticated` ainda tinha `INSERT` e `UPDATE` em `messages`. Um participante podia contornar a rota pela Data API e persistir texto arbitrário ou reescrever mensagens.
2. O suporte atual é template-only. Isso é compatível com a UI atual, mas não com a evolução aprovada de suporte conversacional; a ativação foi reservada para a Fase 2.
3. `structured_messages` não possui consumidor do runtime analisado e não deve ser confundida com a tabela `messages` efetivamente usada.

## Mudanças realizadas

- Migration `20260821210644_harden_structured_participant_messaging.sql`: catálogo dos seis templates participantes, proveniência opcional em `messages`, revogação de escrita direta e RPC autenticada.
- `POST /api/messages/send-template` agora rejeita conteúdo livre, confere papel persistido e chama a RPC; não persiste `body` no servidor Next.
- Validator tipado da Fase 2 define categorias, limites, plain text e ausência de `actorRole` no futuro contrato de ticket.
- Contrato canônico e ADR registram lifecycle, RLS, thread e compatibilidade.

## Migrations e rollback conceitual

Há uma migration nova, não destrutiva. Registros antigos permanecem com `messages.template_id = NULL`. Rollback operacional significa restaurar grants somente após remover a rota/RPC dependente; não deve ser executado em produção, pois reabriria a escrita arbitrária.

## Testes executados

- `npm run typecheck`: passou.
- `npm run lint`: passou, sem violações da política visual, online-only ou ESLint.
- Vitest focal (`send-template`, ticket atual e validator futuro): 3 arquivos, 9 testes, passou.
- pgTAP focal: 14 testes, passou.
- pgTAP/RLS local completo: 69 arquivos, 1.498 testes, passou.
- `npm run build`: compilação, verificação de tipos e geração das 110 páginas concluídas; artefato `.next/BUILD_ID` presente.
- `supabase db lint`: executado; aponta erros pré-existentes nas rotinas da extensão pgTAP e avisos legados de imutabilidade. A migration desta fase não gerou ocorrência no relatório.

Nenhuma migration foi aplicada a HML ou produção e nenhum e-mail, pagamento ou
sessão foi disparado.

## Plano preciso para Fase 2

1. Fazer preflight dos statuses reais de `support_tickets`.
2. Criar `support_ticket_messages` com RLS/índices e campos de lifecycle usados.
3. Migrar criação de ticket para o contrato de texto livre idempotente.
4. Implementar Meus chamados e detalhe do terapeuta/paciente sem expor notas.
5. Cobrir respostas públicas, reabertura e booking autorizado com testes multi-persona antes de habilitar a UI.
