# Task Matrix

Esta matriz contém somente trabalho real. Cada tarefa tem owner, reviewer,
dependências e isolamento de escrita. Status permitidos: `TODO`, `READY`,
`IN_PROGRESS`, `BLOCKED`, `REVIEW`, `QA` e `DONE`.

| Task                                             | Owner               | Reviewer                 | Depends On                                 | Status      | Branch/Worktree                          |
| ------------------------------------------------ | ------------------- | ------------------------ | ------------------------------------------ | ----------- | ---------------------------------------- |
| Auditar arquitetura Zoom e lifecycle             | Sessions & Zoom     | Security & Supabase + QA | Fontes locais e runtime Zoom               | DONE        | Somente leitura                          |
| Auditar schema, RLS e idempotência Zoom          | Security & Supabase | Sessions & Zoom + QA     | Migrations e Supabase MCP                  | DONE        | Somente leitura                          |
| Auditar sala e reflexo do cliente                | Public / Patient    | Sessions & Zoom + QA     | Contratos de encontro                      | DONE        | Somente leitura                          |
| Auditar sessão e reflexo do terapeuta            | Therapist Product   | Sessions & Zoom + QA     | Contratos de sessão                        | DONE        | Somente leitura                          |
| Auditar observabilidade Admin de sessão          | Admin               | Sessions & Zoom + QA     | Read models Admin                          | DONE        | Somente leitura                          |
| Auditar harness local e HML                      | QA & Release        | Orchestrator + owners    | Runbooks, Playwright e ambientes           | DONE        | Somente leitura                          |
| Consolidar gaps e contratos de implementação     | Orchestrator        | Todos os owners          | Auditorias de domínio                      | DONE        | Worktree atual, docs de coordenação      |
| Implementar correções Zoom/lifecycle             | Sessions & Zoom     | Security & Supabase + QA | Contrato aprovado                          | DONE        | Worktree atual                           |
| Implementar correções de experiência cross-shell | Owners de produto   | Sessions & Zoom + QA     | Contrato aprovado                          | DONE        | Worktree atual                           |
| Implementar hardening Supabase, se necessário    | Security & Supabase | Sessions & Zoom + QA     | Confirmação humana para migration/RLS      | QA          | Worktree atual                           |
| Integrar e executar gate local completo          | Orchestrator        | QA & Release + owners    | Handoffs aprovados                         | DONE        | Worktree atual após revisão              |
| Homologar sessão Zoom real em HML                | QA & Release        | Orchestrator + owners    | `READY_FOR_HML`, webhook e Supabase remoto | BLOCKED     | HML controlada, Playwright headed        |

## Arquivos de alto conflito reservados

- `src/features/zoom/**`, `supabase/functions/zoom-*` e `docs/zoom/**`:
  Sessions & Zoom.
- `supabase/migrations/**`, `supabase/tests/**` e tipos gerados:
  Security & Supabase.
- `src/features/patient-*` e `/app/encontros*`: Public / Patient.
- `/terapeuta/sessoes*` e `src/features/therapist-*`: Therapist Product.
- `src/features/admin-operations/**` e `/admin/sessoes*`: Admin.
- `tests/e2e/zoom*`, `scripts/zoom/*` e evidências sanitizadas: QA & Release.

Qualquer sobreposição exige coordination note e handoff antes de editar.
