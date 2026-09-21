# Function V2 em HML e conclusão do gate SQL local

Data: 2026-09-18. ADR-024. Documentação atualizada.

## Resultado

`session-feedback-command` já existia em HML, mas a revisão 15 publicada usava
o contrato legado. Foi atualizada para o contrato V2, revisão de deploy 16,
`ACTIVE`, no projeto explicitamente linkado `emzwqkmrryuqvqiohqnu`.
O gate SQL local anteriormente pendente passou: 165 arquivos, 3.245 testes.

## Evidência HML

- Download anterior exigia `outcome`/`notPerformedReason` e chamava
  `submit_session_feedback_for_actor_v1`, explicando o HTTP 422 observado.
- Deploy restrito a `session-feedback-command`; preservado `verify_jwt=false`
  já publicado. A validação interna `requireUser` continua obrigatória.
  Nenhum segredo ou outra Function foi alterado.
- Download posterior: seis arquivos locais/remotos equivalentes por AST
  TypeScript, sem comentários ou diferenças de formatação; zero divergências.
  Inclui `index.ts`, `feedback-command.ts` e os quatro módulos compartilhados
  de autenticação, HTTP, CORS e runtime.
- Consulta somente leitura pelo Management API confirmou a migration
  `20260918190000`, a RPC V2 e o wrapper
  `submit_session_quality_feedback_only_v1`. Execute permitido a `service_role`
  e negado a `authenticated`, preservando a fronteira do comando.
- Sessão autorizada: `95a69560-98ea-4434-80f1-645022b7aed5`, `26S000153`.
  Pelo IAB, cliente e terapeuta enviaram “Sim”, nota 5 e comentário vazio.
  Banco: resposta do cliente às `17:34:05.292208Z` e do terapeuta às
  `17:34:25.059133Z`, uma resposta individual por papel.
- Depois do primeiro envio, somente o cliente tinha resposta. O terapeuta
  continuava com seu formulário disponível. Ao concluir ambos, os detalhes
  removeram a ação de avaliar e exibiram a resposta registrada.
- Reabertura na sala do cliente por `?feedback=1` reconheceu sua resposta e
  ofereceu “Avaliar terapeuta (opcional)”. O formulário público existente abriu,
  inclusive com sua avaliação pública anterior editável. Nenhuma avaliação
  pública ou tema privado foi publicado/alterado nesta validação.
- Antes/depois: zero `session_participant_confirmations`, booking `confirmed`,
  pagamento `paid`, financeiro `paid`, Transfer `transferred`. O feedback
  privado não alterou esses estados. Nenhuma escrita direta no banco HML.

## Ambiente local e fixtures

O banco local tinha 342 migrations, terminando em `20260917221000`, e não tinha
a ADR-024. Depois de revisar o dry-run, foram aplicadas progressivamente as seis
migrations existentes: `20260918103000`, `20260918123000`, `20260918140000`,
`20260918150000`, `20260918160000` e `20260918190000`. Nenhuma migration nova.
Novo dry-run: `upToDate=true`, sem migrations, seeds ou roles pendentes.
PostgreSQL local 15 e pin `15.8.1.085` preservados, sem reset ou remoção de
volume. Quatro cron jobs locais permanecem inativos.

As falhas das fixtures eram independentes da correção de produto:

- `004`: preparação alterava a opção de compartilhamento já sob o papel de
  terapeuta autenticado, que corretamente não tem UPDATE. Só a preparação
  volta ao owner; a consulta continua testada como `authenticated`.
- `075` e `076`: horários históricos relativos à hora atual colidiam com
  agendamentos do seed. Datas históricas afastadas mantêm duração, evidência e
  tentativa coerentes. Os deadlines de 7/30 dias continuam relativos ao término.
- `100` e `128`: cenários vivos precisam preservar T+10. O helper temporário
  isola apenas ocupações conflitantes das identidades/intervalos envolvidos,
  incluindo buffers reais. Guards continuam ativos; o ROLLBACK restaura tudo.
- `130`: `set_config` exige texto; o UUID do ator agora tem cast explícito.

Todos os arquivos terminam com ROLLBACK. O helper reside em `pg_temp`, é invoker
e não permanece no banco após o teste. Não houve alteração permanente de seed,
RLS, grants ou regras de produto para tornar testes aprovados.

## Handoff

STATUS

IMPLEMENTED. Gate SQL local: PASS. Smoke HML positivo dos dois perfis: PASS.

SCOPE

Atualizar a Function existente autorizada em HML e resolver o gate SQL local
pendente por ambiente/fixtures. Não equivale a homologação financeira completa.

FILES CHANGED

- `supabase/tests/004_agenda_sessions_read_models.sql`
- `supabase/tests/075_session_feedback.sql`
- `supabase/tests/076_session_attendance_confirmation_lifecycle.sql`
- `supabase/tests/100_zoom_patient_no_show_termination.sql`
- `supabase/tests/128_session_attendance_role_fences.sql`
- `supabase/tests/130_session_attempt_quality_and_confirmation.sql`
- `supabase/tests/fixtures/isolated-booking-window-local.inc`
- `skills/session-feedback/SKILL.md`
- `docs/zoom/session-feedback-hml-local-fix-2026-09-18.md`
- `docs/zoom/session-feedback-v2-deployment-sql-gate-2026-09-18.md`

DB CHANGES

Somente aplicação local de migrations já versionadas. Nenhuma migration aplicada
em HML; sua ADR-024 já estava vigente. Sem reset ou DDL ad hoc permanente.

PUBLIC CONTRACT CHANGES

Nenhum contrato novo. Deploy alinha a Function ao V2 já usado pela aplicação/RPC.

CROSS-DOMAIN IMPACT / SECURITY IMPACT

Resposta privada por tentativa, sem confirmação/presença ou efeito financeiro.
Consultas remotas somente leitura, restritas ao contrato e à sessão autorizada,
sem chaves/JWT/dados financeiros sensíveis nos artefatos. Autorização preservada.

TESTS / COMANDOS EXECUTADOS

- `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/session-feedback-command`: 3 testes PASS.
- `deno check --config supabase/functions/deno.json supabase/functions/session-feedback-command/index.ts`: PASS.
- `npx supabase functions list --project-ref emzwqkmrryuqvqiohqnu`: revisões 15/16 conferidas.
- `npx supabase functions download session-feedback-command --project-ref emzwqkmrryuqvqiohqnu --use-api --workdir <pasta temporária>`: fontes anterior/posterior comparadas sem substituir arquivos locais.
- `npx supabase functions deploy session-feedback-command --project-ref emzwqkmrryuqvqiohqnu --no-verify-jwt --use-api`: PASS.
- `npx supabase db query --linked --project-ref emzwqkmrryuqvqiohqnu --file <SQL somente leitura> -o json`: contrato e estados da sessão conferidos.
- `npx supabase db push --local --dry-run`, `--local --yes`, novo dry-run: seis migrations locais aplicadas; ambiente alinhado.
- `npx supabase test db --local`: rodada final PASS, `Files=165, Tests=3245`, 32 segundos. As falhas anteriores de ambiente/fixtures descritas acima foram resolvidas.
- `npx supabase db lint --local --level warning`: exit 0; zero erros em funções da aplicação. O resultado bruto contém erros de oito funções pertencentes à extensão pgTAP, ownership confirmado por `pg_depend`/`pg_extension`: `plan`, `add_result`, `_def_is`, `_prokind`, `has_tablespace`, `check_test`, `_currtest`, `row_eq`. Diagnósticos de contexto do runner/compatibilidade da extensão; o lint bruto não é limpo. Permanecem warnings de parâmetros/variáveis não usados em funções existentes.
- `npm run lint`: PASS, políticas visual/online-only/migrations e ESLint sem violações.
- `npx tsc --noEmit`: PASS. Build e QA frontend da etapa anterior estão no relatório histórico; sem mudança de código da aplicação nesta etapa.
- `git diff --check`: PASS.

KNOWN RISKS / LIMITAÇÕES

`db dump --linked --schema public` falhou por pg_dump 15.8 versus PostgreSQL
remoto 17.6. A checagem necessária foi concluída por `db query` via Management
API, sem mudar o pin local. A primeira medição CIM do lint foi negada no sandbox;
medição repetida com acesso apropriado. Operações pesadas executadas em série.

Casos negativos, mobile e financeiros não foram reenviados em HML nesta etapa.
Os testes SQL incluem qualidade negativa, privacidade, idempotência, deadlines,
confirmação e snapshots financeiros; QA frontend anterior permanece registrado
no relatório histórico. Não remover pgTAP nem enfraquecer guards para silenciar
diagnósticos. Rollback de código não deve regressar ao writer legado.

NEEDS FROM OTHER AGENTS

Nenhuma delegação. Alterações das fixtures e documentação permanecem locais,
sem commit, push ou novo PR nesta etapa.

SAFE TO INTEGRATE?

YES, para o escopo de fixtures/documentação e gate SQL aqui verificado.
Produção não foi consultada nem alterada.
