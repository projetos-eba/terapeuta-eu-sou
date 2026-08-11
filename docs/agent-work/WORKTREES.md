# Estratégia de Branches e Worktrees

Worktrees isolam agentes que precisam escrever em paralelo. Não são necessárias
para auditorias somente leitura ou tarefas sequenciais. O Orchestrator reserva
o escopo antes da criação e não executa estes comandos sem necessidade ou
autorização humana.

## Convenção recomendada

O prefixo padrão do Codex neste ambiente é `codex/`:

```bash
git worktree add ../tes-security -b codex/agent-security
git worktree add ../tes-admin -b codex/agent-admin
git worktree add ../tes-stripe -b codex/agent-stripe
git worktree add ../tes-zoom -b codex/agent-zoom
git worktree add ../tes-qa -b codex/agent-qa
```

Se o time aprovar a convenção `agent/*`, os nomes equivalentes são
`agent/security`, `agent/admin`, `agent/stripe`, `agent/zoom` e `agent/qa`.
Escolha uma convenção por sprint; não crie as duas.

## Regras

- Um agente de escrita por worktree e uma tarefa real por branch.
- Não trabalhar diretamente em `main`.
- Não fazer force push, reset destrutivo ou limpeza da worktree alheia.
- Não editar arquivo reservado por outra tarefa sem coordination note e novo
  handoff.
- Rebase/merge ocorre em ordem definida pelo Orchestrator, após self-test.
- Security & Supabase centraliza a criação/ordenação final de migrations.
- Arquivos compartilhados e de alto conflito exigem owner único.
- QA testa a integração, não substitui o self-test de cada branch.
- Remoção de worktree/branch só ocorre após integração confirmada e autorização
  do responsável; use operação recuperável quando possível.

## Fluxo de integração

```text
agent branch/worktree
  -> self-test
  -> handoff
  -> domain review
  -> Security review (quando aplicável)
  -> integração coordenada
  -> QA integrado
  -> release gate
```

O documento histórico `docs/architecture/admin-plan.md` registra trabalho
Admin anterior diretamente em `dev-antonio`. Esta política multi-agent governa
novas sprints paralelas e não reescreve aquele histórico.
