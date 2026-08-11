# Task Matrix

Esta matriz contém somente trabalho real. Cada tarefa tem um owner, um reviewer
e, para escrita paralela, branch/worktree exclusiva. Atualize o status no mesmo
handoff que muda a responsabilidade.

Status permitidos: `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `QA` e
`DONE`.

| Task                                          | Owner            | Reviewer                          | Depends On                                                  | Status  | Branch/Worktree                                                 |
| --------------------------------------------- | ---------------- | --------------------------------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| Configurar infraestrutura multi-agent do TES  | Orchestrator     | QA & Release                      | Auditoria do repositório e suporte oficial do Codex         | DONE    | `dev-antonio` / worktree atual, sem branch nova por solicitação |
| Auditar referências e contratos do lote Admin | Orchestrator     | Admin + Stripe & Finance + QA     | Referências fornecidas e fontes obrigatórias                | DONE    | Somente leitura                                                 |
| Refinar detalhes de profissional e cliente    | Admin            | QA & Release                      | Auditoria visual e contrato `admin_get_operation_detail_v1` | DONE    | Workspace isolado do agente Admin                               |
| Refinar lista e detalhe de verificações       | Admin            | QA & Release                      | Auditoria visual e contrato de verificações atual           | DONE    | Workspace isolado do agente Admin                               |
| Refinar Financeiro Admin                      | Stripe & Finance | Admin + QA & Release              | Auditoria visual e contrato `admin_get_finance_module_v2`   | DONE    | Workspace isolado do agente Stripe & Finance                    |
| Integrar o lote Admin                         | Orchestrator     | Admin + Stripe & Finance          | Handoffs seguros para integração                            | DONE    | Worktree atual após revisão                                     |
| Validar lote Admin integrado                  | QA & Release     | Orchestrator + owners dos achados | Integração, self-tests e reviews concluídos                 | BLOCKED | Supabase local e Browser MCP indisponíveis                      |

## Template para próximas tarefas

Copie a linha abaixo somente quando existir uma tarefa aprovada; não use esta
seção como backlog fictício.

| `<resultado verificável>` | `<owner>` | `<reviewer>` | `<dependências reais ou —>` | TODO | `<branch/worktree ou —>` |

Antes de mudar para `IN_PROGRESS`, registre os arquivos reservados na descrição
da tarefa ou no canal de coordenação. Antes de `DONE`, anexe handoff e estado do
release gate aplicável.
