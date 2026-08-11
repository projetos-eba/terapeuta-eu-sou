# Operação Multi-Agent do TES

Esta pasta contém o contrato de coordenação entre agentes do Terapeuta Eu Sou.
Ela não substitui o `AGENTS.md`: a raiz continua sendo a constituição global e
qualquer `AGENTS.md` mais próximo do arquivo em trabalho acrescenta regras
locais.

## Ordem de uso

1. Leia `AGENTS.md` e os `AGENTS.md` locais aplicáveis.
2. Confirme a meta em `CURRENT_GOAL.md`.
3. Registre somente tarefas reais em `TASK_MATRIX.md`.
4. Consulte `DOMAIN_OWNERSHIP.md` e `INTEGRATION_CONTRACTS.md`.
5. Defina owner, reviewer, dependências, arquivos reservados e ambiente.
6. Use uma branch/worktree por fluxo de escrita quando houver paralelismo.
7. Exija `HANDOFF_TEMPLATE.md` antes de integrar.
8. Passe pelo `RELEASE_GATE.md`; implementação isolada não significa `DONE`.

## Agentes disponíveis

| Nome Codex          | Papel                                                 |
| ------------------- | ----------------------------------------------------- |
| `orchestrator`      | Coordenação, decomposição, dependências e integração. |
| `security_supabase` | Segurança, Supabase e ownership final de migrations.  |
| `admin`             | Produto e operação administrativa.                    |
| `stripe_finance`    | Stripe, pagamentos, assinaturas, ledger e repasses.   |
| `sessions_zoom`     | Agenda, bookings, sessões e Zoom Video SDK.           |
| `qa_release`        | Testes, homologação, evidências e release gate.       |
| `public_patient`    | Aplicação pública e shell do paciente.                |
| `therapist_product` | Shell e produto do terapeuta.                         |

Os agentes de projeto ficam em `.codex/agents/*.toml`. A configuração global
do repositório limita a seis subagentes simultâneos; isso é um teto, não uma
meta. Só paralelize tarefas independentes e com arquivos de escrita distintos.

A versão local confirmada é `codex-cli 0.142.5`. Ela registra cada role em
`.codex/config.toml` por `config_file`, usa `max_threads` no topo e não consegue
executar o modelo pessoal `gpt-5.6-sol`; por isso os agentes fixam `gpt-5.4`,
presente no catálogo local. A documentação oficial mais nova já descreve
autodescoberta dos TOMLs e novas chaves globais. Ao atualizar o Codex, rode
`codex --strict-config doctor` antes de modernizar o schema ou o modelo.

## Como iniciar uma sprint

1. Substitua a meta encerrada em `CURRENT_GOAL.md` por uma meta macro única.
2. Preencha `TASK_MATRIX.md` com tarefas reais, owners, reviewers e
   dependências; deixe bloqueios explícitos.
3. Peça ao Codex: `Use o agente orchestrator para planejar esta meta e delegue
apenas os fluxos independentes aos agentes de domínio.`
4. Crie worktrees somente para tarefas de escrita aprovadas.
5. Faça baseline de QA antes das mudanças e reserve a homologação final para
   depois da integração.
6. Integre somente handoffs marcados `YES` ou `WITH CONDITIONS` e com as
   condições atendidas.

Prompts prontos ficam em `ORCHESTRATOR_PROMPT.md` e `prompts/`.

## Limites atuais

- O repositório não contém workflow versionado em `.github/`; os gates são
  manuais até uma tarefa específica criar CI.
- Perfis de ferramentas em `TOOLS_AND_ENVIRONMENTS.md` são recomendações de
  menor privilégio. Os TOMLs não inventam MCPs nem credenciais ausentes.
- Ações em HML e produção continuam sujeitas a autorização humana e às regras
  do `AGENTS.md`.
