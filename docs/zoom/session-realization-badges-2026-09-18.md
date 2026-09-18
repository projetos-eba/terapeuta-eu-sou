# Estados individuais após avaliação privada — 2026-09-18

Status: **implementado e validado localmente; HML permanece na versão anterior até a publicação deste conjunto**.

## Diagnóstico em HML

- A sessão `95a69560-98ea-4434-80f1-645022b7aed5` possui respostas privadas de cliente e terapeuta na tentativa atual, mas nenhuma linha em `session_participant_confirmations`. Ambas as presenças e o encerramento estão comprovados. O badge da lista do terapeuta vinha do read model de confirmação operacional e continuava “Realizada — confirmação pendente” mesmo após a resposta privada.
- A sessão `c794a4f0-6e9c-4985-a51b-dd4b8055d49d` ainda não possui resposta privada de nenhum participante. A fila do cliente corretamente a inclui, mas o badge a chamava de “Confirmação pendente” em vez de “Avaliação pendente”.
- O cron `tes-session-confirmation-hourly-v1` já está registrado e **ativo** em HML, agendado para `7 * * * *`, com comando `select public.auto_confirm_sessions();`. As cinco execuções recentes consultadas estavam concluídas sem erro. A função implantada contém os vencimentos distintos de cliente +7 dias e terapeuta +30 dias. Nenhuma dessas execuções encontrou confirmação vencida naquele intervalo; isso não prova uma execução com linha elegível em HML.
- A Edge Function `session-feedback-command` V2 publicada anteriormente continua `ACTIVE` em HML, revisão 16. A atualização e a comparação de código remoto estão documentadas em `session-feedback-v2-deployment-sql-gate-2026-09-18.md`; esta correção não exige novo deploy da Function.

## Regra e mudança local

- A realização continua exigindo evidência confiável de presença bilateral e encerramento na tentativa atual. O badge individual passa para `Já realizada`/`Realizada` após a resposta privada **do próprio participante**, sem exigir a avaliação pública opcional, a resposta da outra pessoa ou alteração financeira.
- Antes da resposta, uma sessão realizada e elegível mostra `Avaliação pendente`. A fila do terapeuta deixa de tratar a resposta privada como confirmação operacional; exibe a pendência de avaliação apenas enquanto não houver resposta própria nem confirmação automática.
- No vencimento de 7/30 dias, `auto_confirm_sessions` continua gravando confirmação individual `source=automatic` com idempotência e proteção da tentativa. O leitor do próprio participante retorna `automatically_confirmed`, encerra o formulário não respondido e apresenta a sessão realizada. O cron, a função de escrita e os estados financeiros não foram alterados por esta correção.
- Cancelamento, ausência classificada e tentativa reagendada não herdam a realização visual anterior. A consulta em lote é autorizada apenas aos participantes das reservas solicitadas.

## Validação

- pgTAP local: cenários de resposta individual, separação da avaliação pública, tentativa reagendada, fila do terapeuta, fechamento automático por papel em +7/+30 dias, ausência e privacidade.
- pgTAP completo: 165 arquivos, 3.256 testes aprovados. A fixture do teste 129 agora isola transacionalmente o horário antes de atualizar a reserva, usando o helper já existente; o `ROLLBACK` restaura os dados locais. O gate anteriormente pendente está resolvido nesta versão.
- Front-end: 99 testes focados aprovados, incluindo mapeamento do cliente, badge da lista do terapeuta, resumo de detalhes e formulário após confirmação automática. `typecheck`, lint e build passaram.
- O estado HML dos badges só pode ser revalidado visualmente depois da implantação da migration `20260918200000_actor_realization_read_models.sql` e do app correspondente. O cron de HML não precisa de nova ativação.
