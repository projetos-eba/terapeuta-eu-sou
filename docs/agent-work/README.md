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
| `product_ux`        | Arquitetura de tarefa, estados e responsividade; sem implementação. |
| `visual_director`   | Direção de composição e crítica de identidade TES; sem implementação. |
| `design_system_guardian` | Reuso, variantes, tokens e admissão de patterns; sem implementação. |
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

Nas refatorações visuais, `product_ux`, `visual_director` e
`design_system_guardian` são reviewers sequenciais dos gates A, B e C do
workflow em `docs/design-refactor/multi-agent-workflow.md`. A implementação
continua com o owner de domínio (`public_patient`, `therapist_product` ou
`admin`) e o gate visual integrado fica com `qa_release`. As skills
`tes-ui-experience` e `tes-design-system` permanecem os contratos globais e
não são duplicadas nos TOMLs dos agentes.

A versão local confirmada é `codex-cli 0.142.5`. O manifesto portátil do
projeto registra cada role em `.codex/config.toml` por `config_file`, usa
`max_threads` no topo e fixa `gpt-5.4`, presente no catálogo local. Nesta
versão, `codex --strict-config doctor` inspeciona `~/.codex/config.toml`; ele
não comprova por si só a autodescoberta de `.codex/config.toml`. Antes de uma
sprint multi-agent, o launcher deve confirmar que importou os roles do
manifesto do projeto. Se não os expuser, use os owners de domínio existentes
com handoffs explícitos para os gates A/B/C e registre o bloqueio de runtime;
não assuma que a descoberta ocorreu silenciosamente. Ao atualizar o Codex,
rode `codex --strict-config doctor` antes de modernizar o schema ou o modelo.

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
