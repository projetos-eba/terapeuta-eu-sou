# Prompt do Orchestrator

Use este prompt em uma conversa Codex aberta na raiz do repositório. Substitua
somente os campos entre colchetes.

```text
Use o agente customizado `orchestrator` para coordenar esta meta do TES:

OBJECTIVE
[resultado macro verificável]

CONSTRAINTS
[limites, ambiente, prazo, proibições e decisões humanas já tomadas]

Antes de propor trabalho:
1. leia AGENTS.md e AGENTS.md locais aplicáveis;
2. leia docs/agent-work/CURRENT_GOAL.md;
3. leia docs/agent-work/TASK_MATRIX.md;
4. leia docs/agent-work/DOMAIN_OWNERSHIP.md;
5. leia docs/agent-work/INTEGRATION_CONTRACTS.md;
6. consulte as fontes e skills necessárias de cada domínio.

Então:
- analise impacto, critical paths e riscos;
- divida a meta em tarefas reais e verificáveis;
- atribua um owner e reviewers por tarefa;
- declare dependências e ordem de integração;
- reserve arquivos de alto conflito e impeça sobreposição de escrita;
- use Security & Supabase primeiro quando houver dependência de schema,
  permissão, RLS, grant, Auth ou Storage;
- paralelize somente tarefas independentes;
- exija handoff no formato HANDOFF_TEMPLATE.md;
- encaminhe blockers ao agente ou humano correto;
- acione QA para baseline e, após integração, para o release gate;
- consolide status, evidências, riscos e pendências.

Não implemente sozinho o trabalho dos agentes proprietários. Não crie branch,
worktree, migration, commit, push, PR nem ação em HML/produção sem autorização
aplicável. Não marque DONE com base apenas em implementação.

Primeiro devolva a divisão proposta com owner, reviewer, dependências,
arquivos reservados, testes e critérios de handoff. Só execute mudanças se o
pedido também autorizar implementação.
```

## Dry-run de launch readiness

```text
Use o agente `orchestrator` em modo somente leitura. Analise o estado de launch
readiness do TES e proponha divisão de trabalho. Delegue auditorias independentes
aos agentes adequados, não altere arquivos ou sistemas externos e consolide:
critical paths, owners, reviewers, dependências, blockers, handoffs esperados e
release gate. Não tente executar sozinho as correções encontradas.
```

Fluxo esperado:

```text
OBJECTIVE: TES Launch Readiness
             |
       ORCHESTRATOR
             |
  +----------+-----------+-------------+
  |          |           |             |
Security   Admin      Stripe     Sessions/Zoom
  |          |           |             |
  +----------+-----------+-------------+
             |
       integration
             |
         QA & Release
             |
        Release Gate
```

Public / Patient e Therapist Product entram quando a meta tocar suas
superfícies. Security inicia primeiro quando existir dependência de banco ou
permissão; Admin, Stripe e Sessions podem trabalhar em paralelo somente quando
seus arquivos e contratos estiverem isolados.
