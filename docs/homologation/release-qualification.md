# TES — Release Qualification

Data de início: 2026-08-19

Ambiente: local; HML pendente
Status da rodada: **NOT_READY enquanto os gates P0 reais de Stripe, booking/webhook e Zoom em HML não forem executados**

## Escopo e critérios

Esta qualificação segue o fluxo: descoberta pública → reserva → pagamento →
booking → videochamada → conclusão → financeiro/Admin. O estado autoritativo
continua sendo o banco, as Edge Functions e os webhooks; retorno de navegador
ou renderização não confirma pagamento, reserva ou acesso à sala.

Nenhum segredo, token de sessão, URL assinada ou dado privado é registrado
neste documento.

## Baseline atual

| Gate                | Resultado         | Evidência segura                                                                                                           |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TypeScript          | PASS              | `npm run typecheck`, executado isoladamente após o build.                                                                  |
| Lint                | PASS              | `npm run lint`, incluindo políticas visual e online-only.                                                                  |
| Unitário            | PASS              | `npm run test`: 133 arquivos e 530 testes.                                                                                 |
| Edge Functions      | PASS              | `npm run test:deno`: 134 testes, incluindo o comando de cancelamento.                                                      |
| Build               | PASS              | `npm run build`: 106 rotas geradas, sem falha de compilação ou tipos.                                                      |
| Formatação global   | FAIL              | `npm run format:check`: 196 arquivos pré-existentes fora do formato.                                                       |
| Banco/RLS integrado | PASS              | Supabase local e Edge Runtime iniciados; `npx supabase test db --local`: 60 arquivos e 1.353 asserções.                    |
| Lint de banco       | PASS com ressalva | `npx supabase db lint` saiu com código 0, mas lista avisos prévios de volatilidade/variáveis não usadas para revisar.      |
| Headers HTTP        | PASS              | `next start` + `curl -I /terapeutas`: CSP, anti-frame, nosniff, HSTS e sem `X-Powered-By`.                                 |
| Stripe preflight    | PASS parcial      | Configuração de teste foi validada em rodada anterior; checkout/webhook externo não foi executado nesta retomada.          |
| Zoom preflight      | PASS parcial      | Contratos locais passam; sessão Video SDK real não foi aberta nesta retomada.                                              |
| CI                  | Local/proposto    | Workflow e helper estão versionados em `29f44f3e`; não há evidência de execução remota em CI.                              |
| Navegador visível   | BLOCKED           | O runtime oficial Browser não encontra backend nesta sessão (`browsers.list() = []`); HML não pode ser aberta visualmente. |

## Qualificação incremental — Como funciona

Data: 2026-08-20

Escopo: recriação responsiva da rota pública `/sobre-nos`, inclusão de
`O que é o TES?` no cabeçalho, no menu mobile e no rodapé, seguindo o Figma
`Projeto TES - Copy`, node `14845:668`; refinamento posterior do hero sem CTA,
da tipografia editorial leve, da proteção contra palavras viúvas e da mídia
de alta qualidade nas superfícies públicas com assets editoriais.

| Gate                         | Resultado | Evidência segura                                                                                                                                                                                                                                    |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calibration visual           | PASS      | Comparação local em 1920×1080, 1440×1000, 1024×900 e 390×844; hero inicia após o cabeçalho, não possui CTA e usa IvyPresto Display Light Italic. A sequência mobile foi revisada integralmente, sem critério eliminatório.                          |
| Responsividade e assets      | PASS      | `tests/e2e/public-about.spec.ts`: 6/6 cenários Chromium, sem overflow horizontal, sem imagem local quebrada; hero, cards e mídias editoriais públicas usam WebP em `q=95`, incluindo a versão restaurada de alta resolução do mockup de plataforma. |
| Navegação pública            | PASS      | Teste E2E confirmou `/sobre-nos` no cabeçalho desktop, menu mobile e rodapé; testes unitários focais 6/6.                                                                                                                                           |
| TypeScript                   | PASS      | `npm run typecheck`.                                                                                                                                                                                                                                |
| Lint                         | PASS      | `npm run lint`, incluindo políticas visual e online-only, sem warning ou erro.                                                                                                                                                                      |
| Build                        | PASS      | `npm run build`: 108 rotas geradas; `/sobre-nos` prerenderizada como página estática.                                                                                                                                                               |
| Browser oficial do Codex/HML | BLOCKED   | O backend do Browser oficial continua ausente; a evidência desta rodada é local e headless via Chromium/Playwright.                                                                                                                                 |

Esta rodada não altera o gate global de release: Stripe, booking/webhook e
Zoom reais em HML continuam pendentes.

## Descobertas

| ID          | Severidade | Persona                          | Fluxo                                  | Ambiente     | Reprodução                                                           | Esperado                                                                                                   | Atual                                                                                                                                   | Root cause                                                                                                   | Correção                                                                                                                                           | Teste                                                              | Evidência                                                                                  | Estado   |
| ----------- | ---------- | -------------------------------- | -------------------------------------- | ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- |
| TES-E2E-001 | MEDIUM     | Terapeuta                        | Configurações                          | local        | Rodar o teste de `TherapistSettingsPage`.                            | A suíte localizar o campo de nome exposto pela UI.                                                         | A asserção buscava “Nome de uso interno”; a UI expõe “Nome de acesso”.                                                                  | Teste ficou defasado após a alteração de copy.                                                               | Atualizada a asserção sem alterar dados, API ou autorização.                                                                                       | Teste focal e suíte unitária completa.                             | 7/7 focal; 528/528 unitários.                                                              | VERIFIED |
| TES-E2E-002 | MEDIUM     | Terapeuta/Admin                  | Agenda e documentos privados           | local/HML    | Inspecionar os E2E de agenda e documentos.                           | Esperas devem observar estado real, sem temporizador arbitrário.                                           | Havia `waitForTimeout` para viewport, retry e expiração.                                                                                | Sincronização orientada a tempo, não a estado.                                                               | Agenda aguarda elementos semânticos; uploads/retry não esperam arbitrariamente; expiração consulta a URL assinada até o TTL de domínio de 60 s.    | `typecheck` e varredura sem `waitForTimeout` em `tests/e2e`.       | Sem ocorrências restantes; execução visível pendente.                                      | FIXED    |
| TES-E2E-003 | BLOCKER    | Público/Paciente/Terapeuta/Admin | Navegador visível                      | sessão Codex | Inicializar o runtime oficial e selecionar navegador para a URL HML. | Navegador headed controlável por MCP.                                                                      | O cliente oficial existe no cache do plugin, mas `agent.browsers.getForUrl()` retorna que não há navegador e `browsers.list()` é vazio. | Backend do launcher Browser/Playwright não está registrado nesta sessão; não é falha do TES.                 | Nenhum arquivo foi criado no produto, nenhuma alternativa de browser foi usada e nenhuma modificação no TES é cabível.                             | Inicialização oficial, seleção por URL e diagnóstico de bootstrap. | Runtime oficial retornou lista vazia; sem browser visível para DNS, HTTPS, Vercel ou HML.  | BLOCKED  |
| TES-E2E-004 | BLOCKER    | Paciente/Terapeuta/Admin         | RLS, booking, Stripe e Zoom integrados | local        | Iniciar Supabase, Edge Runtime e executar migrations, lint e pgTAP.  | Containers e comandos transacionais disponíveis.                                                           | O bloqueio anterior de Docker foi removido.                                                                                             | Docker/Supabase local estava indisponível na rodada anterior.                                                | Migrations aplicadas localmente; Edge Runtime iniciado.                                                                                            | `npx supabase test db --local`; `npx supabase db lint`.            | 60 arquivos/1.353 asserções PASS; lint com avisos não bloqueantes.                         | VERIFIED |
| TES-E2E-005 | HIGH       | Engenharia                       | Gate de release                        | local        | Rodar `npm run format:check`.                                        | Base completa formatada.                                                                                   | 196 arquivos reportados fora do formato.                                                                                                | Dívida de formatação pré-existente.                                                                          | Nenhuma formatação global feita para não misturar alterações não relacionadas.                                                                     | Gate global ainda falha.                                           | Saída de `npm run format:check`.                                                           | FOUND    |
| TES-E2E-006 | HIGH       | Engenharia                       | CI/release safety                      | repositório  | Inspecionar o workflow versionado e sua execução remota.             | Pipeline seguro ativo em PR.                                                                               | O workflow foi versionado no commit `29f44f3e`, porém não há evidência de execução remota.                                              | O gate foi criado nesta alteração; a execução no provedor ainda não foi observada.                           | Workflow separa `npm ci`, formatação apenas dos arquivos alterados, tipos, lint, unitários, Deno e build; Stripe/Zoom HML não rodam em PR.         | Leitura estática do workflow e `git ls-files`.                     | `.github/workflows/quality.yml`, `scripts/ci/check-changed-format.mjs`, commit `29f44f3e`. | FOUND    |
| TES-E2E-007 | HIGH       | Paciente/Terapeuta/Admin         | Cancelamento e reembolso               | local        | Repetir e concorrer cancelamentos da mesma sessão paga.              | Uma decisão financeira/auditoria idempotente por comando.                                                  | O comando não recebia `requestId` e inseria nova decisão sem constraint de unicidade.                                                   | A idempotência existia apenas na chamada de refund da Stripe.                                                | Migration adiciona `request_id`, role e `claim_session_cancellation_decision_v1`; UI/API reutilizam o comando; Stripe e transição usam o mesmo id. | pgTAP, Deno e teste React de retry.                                | `049_session_cancellation_idempotency.sql` e testes focais PASS.                           | FIXED    |
| TES-E2E-008 | LOW        | Engenharia                       | Harness de testes Zoom                 | local        | Rodar `npm run zoom:video-sdk:test` no Node atual.                   | Harness sem API obsoleta ou shell implícito.                                                               | O `spawnSync` usava `shell: true` e emitia o aviso `DEP0190`.                                                                           | O processo filho não precisava de shell para executar comandos conhecidos.                                   | Alterado para `shell: false`, preservando a sequência de testes e seus argumentos.                                                                 | Suite Zoom completa.                                               | 17 testes Deno + 17 testes Vitest, sem aviso `DEP0190`.                                    | VERIFIED |
| TES-E2E-009 | HIGH       | Público/Paciente/Terapeuta/Admin | Navegação local                        | local        | Iniciar apenas uma instância Next após o build.                      | Aplicação renderizada sem erro de runtime.                                                                 | O HTTP 500 anterior não se reproduziu.                                                                                                  | Dois processos `next dev` compartilhavam `.next`.                                                            | Processo concorrente encerrado; build isolado foi concluído.                                                                                       | HTTP local e build.                                                | `/terapeutas` respondeu 200; `npm run build` PASS.                                         | VERIFIED |
| TES-E2E-010 | MEDIUM     | Público/Paciente/Terapeuta/Admin | Headers de segurança                   | local        | Subir `next start` e consultar os cabeçalhos da rota pública.        | Política global, sem identificação desnecessária do framework.                                             | O cabeçalho `X-Powered-By` ainda expunha Next.js.                                                                                       | `poweredByHeader` não estava desativado.                                                                     | CSP, anti-frame, nosniff, referrer, permissions, HSTS e `poweredByHeader: false` no boundary Next.                                                 | Teste de contrato, build e HTTP local.                             | `src/lib/security-headers.test.ts`; `curl -I /terapeutas`.                                 | VERIFIED |
| TES-E2E-011 | BLOCKER    | Paciente/Terapeuta               | Reserva/booking                        | local        | Verificar `EXECUTE` de `reserve_booking_hold_v1` como authenticated. | Somente Edge Function com `service_role` invoca o comando transacional.                                    | Uma migration que recriou o RPC deixou `EXECUTE` implícito para API roles.                                                              | PostgreSQL recria permissões padrão quando uma função é recriada.                                            | Migration restabelece revogação explícita e grant exclusivo para `service_role`; RPC interno de slots também foi fechado.                          | pgTAP de agenda e autorização, mais suíte completa.                | `003_agenda_a2_transactional_foundation.sql`; 1.353 asserções PASS.                        | VERIFIED |
| TES-E2E-012 | HIGH       | Público/Paciente/Terapeuta/Admin | Views públicas e privadas              | local        | Inspecionar ACLs das views do schema `public`.                       | Views são read models sem DML/DDL para papéis de API.                                                      | Views recriadas possuíam `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` e `TRIGGER`.                                            | Default privileges do PostgreSQL eram permissivos para relações novas.                                       | Matriz explícita de somente leitura para views; defaults de `postgres/public` agora falham fechados.                                               | Testes de invoker/ACL e suíte pgTAP completa.                      | `044_security_authorization_surface.sql`: 32 asserções PASS.                               | VERIFIED |
| TES-E2E-013 | MEDIUM     | Engenharia                       | Contratos pgTAP                        | local        | Executar a suíte completa após migrations de identidade/publicação.  | Asserções acompanham DTOs e políticas canônicas.                                                           | Cinco arquivos usavam privilégios, colunas, contagens ou plano de teste defasados.                                                      | Mudanças intencionais de DTO público, fixtures persistentes e novos cenários Zoom não atualizaram os testes. | Ajustadas asserções para projection por slug, base table privada, fixture específica, default de tema e contagem real de casos.                    | Suíte pgTAP completa.                                              | 60 arquivos/1.353 asserções PASS.                                                          | VERIFIED |
| TES-E2E-014 | BLOCKER    | Paciente/Terapeuta/Admin         | Golden Path e Zoom reais em HML        | HML          | Rodar o preflight HML e abrir a URL HML pelo MCP Playwright.         | URL HML alcançável pelo navegador MCP e harness com acesso SSO/share, Supabase HML e personas controladas. | O reteste atual parou antes da navegação: o runtime oficial não disponibiliza browser algum.                                            | Infraestrutura da sessão não registrou backend Browser/Playwright; acesso HML não pode ser exercitado.       | Nenhuma tentativa de checkout, webhook, reserva ou Zoom foi feita; não há contorno local para uma qualificação HML remota.                         | Inicialização do runtime Browser e seleção por URL HML.            | `browsers.list() = []`; `getForUrl()` falhou antes de DNS/HTTPS/Vercel.                    | BLOCKED  |

## Próximos gates

1. Restaurar no launcher do Codex um backend Browser/Playwright visível com
   conectividade externa. Depois, usar o acesso HML autorizado já fornecido
   somente em runtime, sem registrá-lo em arquivos, logs ou evidências.
2. Executar o golden path HML por MCP Playwright visível com contexts separados
   para paciente, terapeuta e Admin; o wrapper Browser sem backend não substitui
   o MCP oficial já disponível.
3. Homologar o golden path externo em Stripe test mode: Checkout, retorno,
   webhook assinado, duplicação/atraso de webhook, booking e financeiro.
4. Executar `npm run homologation:zoom:local` com pagamento canônico confirmado
   e validar host-first, janela T-16/T-15, refresh, reconexão e acesso indevido.
5. Reproduzir o cancelamento pelo endpoint/Edge Function com Stripe test mode;
   os testes de banco já cobrem a atomicidade, mas ainda falta a confirmação do
   provedor externo.
6. Corrigir a dívida de formatação em alteração coesa e separada; o gate global
   ainda aponta 196 arquivos fora do padrão.
7. Revisar os avisos restantes do `supabase db lint`, em especial as
   classificações de volatilidade em métricas e financeiro.
8. Observar uma execução remota do workflow versionado em `29f44f3e`; Stripe,
   Zoom e E2E com credenciais continuam fora do CI seguro.

## Impacto documental

Documentação atualizada: este relatório,
`docs/product/sitemap.md`, `docs/product/routes-map.md`,
`docs/product/page-inventory.md`, `skills/public-about/SKILL.md`,
`skills/payments-billing/SKILL.md`, `docs/payments/architecture.md` e
`docs/security/authorization-surface-hardening.md` registram a idempotência de
cancelamento, os limites `service_role` dos RPCs, a matriz read-only das views
e os novos gates de homologação. A evidência desta retomada também corrige o
status do CI (somente worktree, não versionado) e registra o bloqueio externo
do Playwright/HML sem incluir tokens, cookies ou credenciais.

## Fase 0.5 — Unblock Golden Path

Data: 2026-08-21

| Gate                     | Resultado | Evidência segura                                                                                                                                                                                                                    |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth bypass fail-closed  | PASS      | O fallback de `MASTER_PASSWORD` passou a exigir flag explícita e Supabase local; Deno 17/17 no foco e 156/156 na suíte. As três funções de login foram implantadas somente em HML.                                                  |
| Stripe HML preflight     | PASS      | Preflight Admin-only HML, sem mutação: test mode, API, catálogo Billing, webhooks plataforma/Connect, functions, estado autoritativo de pagamento, fixture pública com slot, Connect e credencial operacional de repasses passaram. |
| Multi-context Playwright | PASS      | 1/1 em Chromium: paciente, terapeuta e Admin chegaram simultaneamente às áreas privadas em BrowserContexts, cookie jars e storages independentes.                                                                                   |
| HML migration alignment  | PASS      | Listagem vinculada local/remoto está alinhada inclusive para `20260821142516`; esta rodada não aplicou a migration.                                                                                                                 |
| Known local tests        | PASS      | Vitest 142/555, Deno 156/156, pgTAP 68/1.484, typecheck, lint e build (110 rotas) passaram.                                                                                                                                         |

O CI remoto foi observado, mas a execução mais recente falha no check de
formatação de um arquivo alterado em outra frente; segue P1 para RC e não
bloqueia a Fase 1. Não houve Checkout, cobrança, booking, Zoom ou transferência
nesta etapa.

Decisão: **PHASE 1 READY**. A aprovação é apenas para iniciar o Golden Path
controlado em HML; não é aprovação de produção.

## Fase 1 — execução interrompida com segurança

Data: 2026-08-21
Resultado: **PHASE 1 FAIL**

| Checkpoint                                                   | Status     | Evidência                                                                                       |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| Discovery público                                            | PASS       | Perfil, serviço e preço da fixture foram observados em HML.                                     |
| Contextos isolados                                           | PASS       | Paciente, terapeuta e Admin foram autenticados em BrowserContexts independentes.                |
| Fixture controlada T-15                                      | PASS       | Regra temporária e configuração foram liberadas pelo harness ao encerrar.                       |
| Novo booking/Checkout                                        | BLOCKED    | Uma reserva pendente de uma execução interrompida ocupa o intervalo exclusivo da única fixture. |
| Webhook, pagamento, Zoom, financeiro e Admin correlacionados | NOT_TESTED | Não há cenário novo pago e atribuído de forma autoritativa.                                     |

Nenhum estado foi corrigido manualmente. A reserva pendente não foi cancelada,
apagada, atualizada nem reutilizada. O próximo run deve aguardar sua expiração
canônica ou usar uma janela nova que não conflite. A extensão Admin-only usada
para fixture é limitada ao host HML e não deve ser implantada em produção.

### Retry Fase 1

O retry parou no precheck, antes de checkout: a função HML Admin-only retornou
fixture_slot_not_clean. Não foram criados booking, hold, Checkout, pagamento
ou sessão de vídeo nesta segunda tentativa. A reserva pendente anterior segue
intacta e apenas observada.

O retry expandiu a busca, em leitura autoritativa, de 24 a 72 horas e pelas
fixtures públicas elegíveis. Resultado: **NO CLEAN HML FIXTURE AVAILABLE**.
Não houve mutação de agenda ou criação de operação.

## Fase 1A — Provisionamento da fixture oficial HML

Data: 2026-08-21
Resultado: **GOLDEN PATH FIXTURE READY**

O bloqueio anterior era de qualificação: a janela casual consultada possuía uma
reserva pendente que permanece intacta. A fixture oficial reutiliza a persona
QA pública `antonio-ferrari-e2e` e o serviço QA público de 50 minutos por
R$ 120,00. A localização futura é determinística e não depende de um horário
fixo: executar o preflight HML Admin-only `find_clean`, selecionar `slot` e
manter `fallbackSlots` como B/C.

| Gate                                     | Resultado | Evidência sanitizada                                                                                         |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Terapeuta aprovado, publicável e visível | PASS      | Perfil público QA renderizado e elegível para reserva.                                                       |
| Serviço/terapia online ativos            | PASS      | Serviço público QA com preço e duração canônicos.                                                            |
| Agenda exclusiva de QA                   | PASS      | Faixa de sábado 09:00–17:00 criada pela tela autenticada e comando oficial de agenda.                        |
| Slots A/B/C independentes                | PASS      | Precheck retornou 22/08/2026 às 14:00, 15:00 e 16:00 BRT, com espaçamento canônico.                          |
| Paciente e Admin QA                      | PASS      | Playwright HML 1/1 confirmou as três personas isoladas.                                                      |
| Stripe e webhook assinados prontos       | PASS      | Preflight HML 10/10: test mode, catálogo, webhooks e funções críticas.                                       |
| Connect da fixture                       | PASS      | Transferências ativas e read model sincronizado pelo fluxo oficial Stripe Connect.                           |
| Ausência de conflitos transacionais      | PASS      | Slot engine e precheck Admin-only confirmaram ausência de booking, hold, payment e video session para A/B/C. |

Alterações HML: somente a regra semanal de sábado da conta QA, salva pelo fluxo
de produto, e o deploy HML do precheck Admin-only que agora seleciona três
slots independentes. Não houve SQL administrativo, alteração de produção,
onboarding fictício de Connect, Checkout, cobrança, booking, pagamento ou Zoom.

Validações: `deno check` do precheck, `npm run test:deno` (156/156),
`npm run typecheck`, `npm run lint`, Playwright HML multi-context (1/1) e
preflight Stripe HML (10/10). Nenhuma migration foi criada ou aplicada.

Risco remanescente: a disponibilidade é uma regra semanal compartilhada pela
fixture QA; a próxima execução deve chamar novamente o precheck imediatamente
antes de iniciar um único booking e usar B/C apenas se A ainda não tiver sido
iniciada. A reserva pendente histórica continua sob observação, sem mutação.
Fase 1 pode começar diretamente pelo Golden Path, mas este resultado não é
aprovação de produção.

## Fase 1 — Golden Path transacional HML (tentativa 2026-08-21)

Decisão: **PHASE 1 FAIL**

O precheck selecionou um slot A limpo imediatamente antes da execução. As
superfícies pública e autenticadas foram abertas em contexts independentes e a
reserva criou somente uma operação pendente canônica. Não foi empregado SQL,
mock, atualização manual de status, reuse de Checkout ou fallback B/C.

| Checkpoint            | Resultado  |
| --------------------- | ---------- |
| Fixture precheck      | PASS       |
| Public discovery      | PASS       |
| Booking initiation    | PASS       |
| Stripe Checkout       | FAIL       |
| Signed webhook        | FAIL       |
| Authoritative payment | FAIL       |
| Booking confirmed     | FAIL       |
| Cross-persona         | NOT_TESTED |
| Video session ready   | NOT_TESTED |
| Zoom access window    | NOT_TESTED |
| Therapist join        | NOT_TESTED |
| Patient join          | NOT_TESTED |
| Session completion    | NOT_TESTED |
| Therapist financial   | NOT_TESTED |
| Admin consistency     | NOT_TESTED |
| Database invariants   | NOT_TESTED |

Evidência autoritativa sanitizada: a Stripe test reportou a Checkout Session
como `open`/`unpaid`; o banco HML reportou booking `pending_payment`, payment
`pending`, BRL/R$ 120,00, nenhuma `video_session` e nenhum evento processado
`checkout.session.completed`. Isso explica os checkpoints seguintes sem inferir
defeito em webhook, Zoom ou read models.

O harness foi ajustado para não chamar um submit de “Checkout concluído” antes
de receber o redirect de sucesso. Não houve nova tentativa: o booking desta
execução já foi iniciado e permanece evidência HML; B/C não são fallback válido
neste ponto. A reserva histórica anterior não sofreu mutação e sua avaliação
formal continua na Fase 2.

Próxima ação mínima: investigar por que o Embedded Checkout test não concluiu a
interação (campos/validação/retorno), criar teste de regressão do harness ou do
fluxo conforme a causa e iniciar outra tentativa apenas com nova fixture limpa.

## Fase 1B — Qualificação do Embedded Checkout HML

Data: 2026-08-21
Resultado: **PHASE 1B PASS**

| Checkpoint                  | Resultado | Estado autoritativo / evidência sanitizada                                               |
| --------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Checkout return config      | PASS      | Stripe test `embedded_page`; retorno HTTPS HML em `/reserva/sucesso`; redirect `always`. |
| Embedded Checkout render    | PASS      | Iframe do Checkout anexado no browser visível.                                           |
| Payment interaction         | PASS      | Formulário real Stripe test submetido após completar os campos suplementares exigidos.   |
| Redirect `/reserva/sucesso` | PASS      | O harness só prossegue após observar a rota canônica.                                    |
| Stripe Checkout final state | PASS      | `complete` e `paid`, em test mode.                                                       |
| Signed webhook              | PASS      | Um `checkout.session.completed` correlacionado foi processado.                           |
| Authoritative payment       | PASS      | Pagamento canônico `paid`, BRL/R$ 120,00.                                                |
| Booking confirmation        | PASS      | Booking `confirmed`/`paid`; um pagamento para o booking.                                 |

Root cause da falha anterior: **harness de qualificação incompleto**, não
defeito comprovado do produto, webhook ou booking. O submit original preenchia
somente cartão/validade/CVC e não completava os controles suplementares que a
Stripe exibiu neste Checkout incorporado. O novo harness completa nome/CEP
quando presentes, registra somente atributos e mensagens sanitizados e torna o
redirect uma precondição explícita. Não houve mudança de UI, arquitetura de
pagamento, Stripe mode, estados de banco ou regra de domínio.

Estado das tentativas: a tentativa histórica e a Fase 1 interrompida permanecem
somente como evidência HML, sem mutação. A nova operação foi confirmada pelo
Stripe/webhook/banco; sua `video_session` canônica existe, mas Zoom não foi
acessado nesta fase.

Validações: `npm run test:deno` 156/156, `deno check` do preflight, `node
--check` do harness, Prettier focal, deploy somente da Edge Function Admin-only
em HML e inspeção pós-pagamento somente leitura. Nenhum segredo, cookie, token,
URL assinada ou identificador Stripe foi persistido.

A Fase 1 pode ser retomada a partir de **Cross-persona → Video Session → Zoom →
conclusão → financeiro → Admin → invariantes**. Esta qualificação não declara
produção pronta e não executa esses checkpoints.

## Fase 1C — Continuação do Golden Path HML

Data: 2026-08-21
Resultado: **PHASE 1 FAIL**

| Checkpoint                      | Resultado  |
| ------------------------------- | ---------- |
| Paid booking recheck            | PASS       |
| Cross-persona consistency       | PASS       |
| Video session ready             | PASS       |
| Zoom access window              | BLOCKED    |
| Therapist join                  | NOT_TESTED |
| Patient join                    | NOT_TESTED |
| Video session active            | NOT_TESTED |
| Video session end               | NOT_TESTED |
| Session completion              | NOT_TESTED |
| Therapist financial consistency | NOT_TESTED |
| Admin operational consistency   | NOT_TESTED |
| Database invariants             | NOT_TESTED |

Recheck autoritativo: booking `confirmed`/`paid`; `session_payments=paid` em
BRL/R$ 120,00; uma payment, uma video session `ready`, webhook Stripe já
processado e vínculos de booking/payment/video íntegros. O browser visível
confirmou a consistência paciente/terapeuta/Admin em contexts independentes e
o bloqueio correto antes de T-15.

O bloqueio dentro da janela não é de produto: a booking canônica está marcada
para 23/08/2026 às 10:15 BRT. O harness oficial aceita apenas uma booking entre
15 e 20 minutos antes do início ou prepara uma nova fixture. Não existe um
controle temporal HML versionado para a política Zoom que preserve esta booking
já paga, e esta fase proíbe criar outra. Zoom, conclusão, financeiro e a
consistência Admin pós-sessão não foram iniciados.

Classificação: P1 de qualificação HML. A decisão é FAIL porque checkpoints
obrigatórios não puderam ser demonstrados; isso não é uma declaração de defeito
de Zoom, do produto, de webhook ou de financeiro. As tentativas históricas
pendentes permanecem intactas para a Fase 2.

## Fase 1D — Zoom + conclusão do Golden Path HML

Data: 2026-08-21
Resultado: **PHASE 1 BLOCKED — OUTSIDE ZOOM WINDOW**

Precheck autoritativo somente leitura: booking ainda `confirmed`/`paid`,
pagamento `paid` em BRL/R$ 120,00, uma payment e uma video session `ready`.
O horário canônico permanece 23/08/2026 às 10:15 BRT e a consulta ocorreu antes
de T-15. Não houve acesso a Zoom, entrada de host/paciente, alteração manual ou
nova operação. A próxima execução deve começar às 10:00 BRT com o mesmo booking
e novo precheck; não criar Checkout, pagamento, fixture ou video session.

## Merge `dev-vini` → `dev-antonio` — qualificação incremental

Data: 2026-08-23
Ambiente: local; HML não configurado nesta máquina
Estado: **NOT_READY**

O merge permanece sem conflitos e sem reset ou abort. A nomenclatura visível foi
consolidada como **Assessora Aura**, preservando a rota técnica
`/terapeuta/assessor-ia`; Resultados, Meu plano e Histórico da Jornada permanecem
nas respectivas superfícies. A prontidão operacional inclui os documentos
privados obrigatórios e Connect submetido, sem tratar análise externa válida como
pendência bloqueadora. Serviços preservam a copy canônica e a asserção de imagem
do catálogo.

### Segurança, migrations e dados privados

| Gate | Resultado | Evidência sanitizada |
| --- | --- | --- |
| Migration de leitura server-side | PASS | `20260823133000_grant_service_role_private_identity_read.sql` aplicada localmente; somente `service_role` recebeu `SELECT` mínimo para o cálculo server-side de prontidão. |
| Storage privado sem acesso direto | PASS | `20260823134500_remove_unversioned_private_documents_storage_policy.sql` aplicada localmente; nenhuma policy de browser permanece para o bucket privado. |
| Contrato focal de Storage | PASS | `053_therapist_private_documents_bucket.sql`: 4/4. |
| Documentos privados no navegador | PASS | Playwright headed local: upload, substituição, revisão, reenvio, isolamento entre terapeutas e expiração de URL assinada; 1/1. |
| Lint de schema | PASS com ressalva | `npx supabase db lint --local` saiu com código 0; quatro avisos preexistentes de parâmetros/variáveis não usados permanecem rastreados. |
| pgTAP completo | FAIL | 76/78 arquivos concluíram; falham `006_agenda_a4_blocks.sql` (fixture de impacto ausente) e `061_email_outbox_dispatch.sql` (contagem não isolada do outbox). Não houve correção especulativa. |

As duas migrations são necessárias também no ambiente alvo: não há correção local
ad hoc, nem alteração de schema sem arquivo versionado. Elas não expõem DTO
público, token, cookie, segredo ou documento.

### Gates locais executados nesta rodada

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Integridade do merge | PASS | Nenhum arquivo não resolvido; `git diff --cached --check` sem saída. |
| TypeScript | PASS | `npm run typecheck`. |
| Lint | PASS | `npm run lint`. |
| Unitários | PASS | `npm run test`: 157 arquivos, 630 testes. |
| Edge Functions | PASS | `npm run test:deno`: 171 testes, 0 falhas. |
| Build | PASS | `npm run build`: compilação, tipos e 113 páginas estáticas concluídos. |
| Navegação/autenticação pública | PASS | Playwright headed local: login, retorno, navegação pública e responsividade nas specs focais. |
| Terapias e pagamento de plano | PASS | Playwright headed local: serviços 2/2; checkout de plano 3/3. O redirect nunca foi usado como confirmação de pagamento. |
| Zoom local UI | FAIL | Duas specs bloqueiam corretamente uma booking de fixture já fora da janela temporal; nenhuma JWT ou entrada indevida foi emitida. A fixture deve ser renovada por fluxo controlado, sem enfraquecer o gate T-15. |

### Bloqueios de HML e go/no-go

Não foram executados Stripe test mode, Playwright HML, documentos HML ou sessão
Zoom HML nesta máquina: as variáveis de configuração e credenciais efêmeras
necessárias não estão presentes. Não houve tentativa externa, cobrança, retry
cego ou sessão Zoom real. A comparação visual registrada com Figma também está
pendente nesta rodada.

Para retomar: corrigir ou isolar as duas fixtures pgTAP, disponibilizar HML e
executar sequencialmente o preflight Stripe, os contexts de paciente/terapeuta/
Admin e, após confirmação manual do endpoint ativo, uma única sessão Zoom curta
com evidência sanitizada. Só então reavaliar `HOMOLOGATED`; esta rodada não
autoriza `PRODUCTION-READY`.

## Fase 1D — Execução real Zoom + conclusão do Golden Path HML (retomada)

Data: 2026-08-23, 10:01–10:10 BRT

Resultado: **PHASE 1 PASS**

O booking pago/confirmado da Fase 1B foi preservado e reutilizado sem nova
operação financeira. O precheck autoritativo confirmou R$ 120,00 BRL, uma
payment, uma video session `ready` e a janela T-15 aberta.

| Checkpoint | Resultado |
| --- | --- |
| Paid booking recheck | PASS |
| Zoom access window | PASS |
| Therapist join | PASS |
| Host session state | PASS |
| Patient join | PASS |
| Video session active | PASS |
| Video session end | PASS |
| Session completion | PASS |
| Therapist financial consistency | PASS |
| Admin operational consistency | PASS |
| Database invariants | PASS |

Evidência: o harness oficial HML completou contexts isolados e host-first;
webhook Zoom `session.user_joined` liberou o paciente; os dois participantes
entraram na mesma sessão real, câmera local/remota foi observada, a sessão ficou
ativa por 45 segundos e o encerramento gerou `session.ended` e `status=ended` no
backend. Paciente, terapeuta, financeiro e Admin responderam 200. Os RPCs
privados de overview/recebimentos/repasses/Connect retornaram, com bruto de
R$ 120,00, comissão de R$ 24,00, terapeuta de R$ 96,00 e repasse em
`waiting_confirmation`.

O primeiro retry em T-15 falhou somente no harness por seletor obsoleto. O
seletor foi alinhado ao `href` canônico da rota `/terapeuta/sessoes/:id/video`;
`node --check` e `zoom-hml.test.mjs` (15/15) passaram. Não houve alteração de
produto, banco, webhook, Stripe ou produção.

A confirmação/feedback bilateral posterior não foi enviada. A consulta
read-only identificou que a migration de `session_participant_confirmations`
ainda não está aplicada no schema HML e o endpoint de feedback retornou estado
indisponível; isso fica registrado para a fase de comunicação/operação e não foi
usado para alterar booking ou financeiro. As tentativas históricas pendentes
foram apenas observadas; não há payment `pending` atual e os registros antigos
estão em estados canônicos cancelados/refundados.

Plano resumido da Fase 2 (não executado): abandono/expiração de holds, Checkout
recusado, webhooks duplicados/atrasados, concorrência, cancelamento, refund,
reagendamento, idempotência, reconnect/refresh Zoom, acesso indevido e
confirmação/feedback bilateral.

### Release Readiness Board — atualização após Fase 1D

| Área | Status mais recente | Observação |
| --- | --- | --- |
| Stripe Checkout → webhook → pagamento | PASS | Checkout test, webhook processado e payment autoritativo `paid`. |
| Connect/financeiro | PASS | Read models privados e Connect consultados; repasse não foi forçado. |
| Zoom Video SDK/host-first | PASS | Join real de terapeuta e paciente, encerramento e invariantes. |
| Admin operacional do Golden Path | PASS | Detalhe e correlação da operação disponíveis. |
| CI remoto | P1 | Continua pendente de execução verde para a revisão atual. |
| E-mail real HML | P1 | Fase 3. |
| Rotas de pagamento/comprovante do paciente | P1 | Gap pré-existente de App Router, fora do Golden Path executado. |
| Feedback/confirmations HML | P1 | `session_participant_confirmations` ausente no schema HML; alinhar antes da qualificação operacional. |

P0 remanescente: nenhum identificado nesta qualificação. Isto não equivale a
Production Ready; a decisão cobre somente o Golden Path transacional em HML.

## Fase 2 — Failure Paths e Resiliência HML

Data: 2026-08-23, somente HML/test mode. Resultado: **PHASE 2 FAIL**.

| Cenário | Status | Evidência / root cause | Próxima ação |
| --- | --- | --- | --- |
| Recusa Stripe | PASS | `payment_intent.payment_failed` recebido e processado; pagamento local `failed`. | Regressão automatizada. |
| Checkout abandonado/expirado | FAIL | Webhook real processado e payment `canceled`, mas booking ficou `pending_payment/payment_status=cancelled`; o slot não voltou à disponibilidade. | P1: corrigir lifecycle canônico de booking/hold. |
| Hold/slot após falha | FAIL | O hold não ficou ativo, porém o booking cancelado continuou conflito no slot engine. | P1: validar release transacional. |
| Webhook duplicado/atrasado | BLOCKED | Replay local rejeitado por divergência entre secret remoto HML e secret disponível ao harness; entregas Stripe reais seguem processadas. | P1: canal seguro para replay assinado. |
| Concorrência independente | PASS | Uma tentativa oficial venceu e a outra recebeu 409; um booking apenas. | Manter regressão. |
| Dois pacientes distintos | BLOCKED | Falta segundo paciente QA autorizado. | P1: provisionar credencial QA. |
| Double-click/retry | PASS | Mesmo request id retornou a mesma operação; sem duplicidade. | Manter regressão. |
| Refund | PASS | Refund Stripe test real, uma refund succeeded e payment local `refunded`. | Repetir retry após desbloqueio de secret. |
| Cancelamento paciente/terapeuta | PASS | Fluxos oficiais e retries idempotentes; decisões/refunds únicos. | Manter regressão. |
| Reagendamento | PASS | Request repetido e resolução oficial `applied`; booking versionado e horário atualizado. | Validar slot anterior na suíte consolidada. |
| Zoom indevido/encerrado | PASS | Booking errado, role spoof e sessão encerrada negados. | Manter regressão. |
| Zoom antes do host | BLOCKED | Sem sessão futura própria do paciente QA. | P1: fixture Zoom autorizada. |
| Zoom reconnect/refresh/rejoin | BLOCKED | Sem sessão futura própria; não criado novo booking. | P1: executar com fixture dedicada. |
| Confirmações bilaterais/feedback | BLOCKED | `20260823100000_session_attendance_confirmation_lifecycle.sql` local está ausente no HML; HML usa política v1 e `session_service_confirmations`; REST de `session_participant_confirmations`/feedback indisponível. Confirmação oficial do terapeuta alterou `transfer_status` para safety period, portanto o lifecycle participa do financeiro. | P1: alinhar schema/política e validar bilateralmente. |

### Evidências, alterações e riscos

Os testes usaram Edge Functions e Stripe test mode reais. Nenhum secret,
cookie, token ou URL assinada foi documentado. Os bookings de tentativas
interrompidas foram somente observados. A preferência de 24/08 foi aplicada ao
cenário de recusa; cenários que exigiam Connect usaram a fixture canônica de
25/08 por inexistência de Connect elegível em 24/08.

O root cause de produto é a ausência de transição/liberação após payment
`failed/canceled`: `apply_session_payment_state_v1` deixa o booking
`pending_payment`, e o slot engine continua considerando-o conflito. Os demais
bloqueios são de qualificação HML (secret de replay, usuário QA adicional,
fixture Zoom própria e migration/política divergente). A única alteração foi
no harness `scripts/payments/complete-session-checkout-hml.mjs`, que passou a
classificar replay assinado indisponível sem mascarar o estado autoritativo.

Validação local: `node --check` do harness, `zoom-hml.test.mjs` **15/15**,
`npm run typecheck` **PASS** e `npm run lint` **PASS**. A lista de migrations
remotas confirmou que `20260823100000` não está aplicada no HML. Nenhuma
migration foi aplicada nesta fase.

P0: nenhum identificado. P1: release de slot/booking após abandono ou falha,
replay duplicado/atrasado, segundo paciente de concorrência, fixture Zoom
adversarial, e alinhamento de confirmações/feedback; permanecem também os P1
pré-existentes de CI, e-mail e rotas de pagamento do paciente.

Fase 3 deve cobrir comunicação e operação. A recomendação final é
**PHASE 2 FAIL**. Isto não declara Production Ready.

Documentação atualizada.

## Fase 2.1 — Closure HML

Data: 2026-08-24, HML/test mode. Resultado: **PHASE 2 FAIL**.

Esta rodada corrigiu somente o lifecycle de booking após falha definitiva de
pagamento e alinhou as migrations pendentes do ambiente HML. Não houve
alteração em produção, pagamento live, SQL manual de estado ou criação de
atalho para Zoom/Stripe.

### Matriz dos cinco gates

| Gate | Resultado | Evidência sanitizada / causa | Próxima ação |
| --- | --- | --- | --- |
| Failed/expired Checkout releases slot | **PASS** | Novo Checkout Stripe test expirado em HML convergiu por webhook real para `financial_status=canceled`, `booking.payment_status=cancelled` e `booking.status=cancelled_by_payment`. A migration transacional libera o intervalo; a regressão pgTAP local confirmou hold novo no mesmo slot e retry idempotente. | Manter no pacote de regressão da Fase 3. |
| Duplicate/delayed webhook | **BLOCKED** | O evento Stripe automático foi processado sem erro terminal. Replay assinado duplicado/atrasado não pôde ser provado: o endpoint HML retornou 400 para o evento assinado pelo harness, e o preflight HML continua `platform_webhook=FAIL` (configuração do secret/runtime não confirmada). Nenhum secret remoto foi copiado ou exposto. | Corrigir a configuração do endpoint/secret por canal seguro e repetir somente o replay HML. |
| Two-patient concurrency | **BLOCKED** | A contenção transacional entre tentativas já possui evidência de um vencedor e um 409. O gate específico de dois pacientes distintos não foi executado porque não existe uma segunda identidade QA autorizada disponível; não foram criados usuários artificiais. | Provisionar segundo paciente QA e repetir com dois contexts isolados. |
| Zoom before-host/reconnect | **BLOCKED** | A política de acesso indevido e sessão encerrada permanece PASS na evidência anterior. O smoke adversarial (antes do host, refresh/reconnect, sair/entrar) não foi executado: não há sessão futura dedicada e o Browser/IAB não estava disponível nesta execução; o backend não foi manipulado para contornar a janela. | Disponibilizar harness/fixture Zoom real HML e executar host-first adversarial. |
| Bilateral confirmation/financial lifecycle | **BLOCKED** | `20260823100000_session_attendance_confirmation_lifecycle.sql` está aplicada no HML; migrations posteriores também estão alinhadas. O contrato local passa no pgTAP 076, incluindo idempotência, conflito e estados financeiros. O fluxo bilateral remoto não foi reexecutado porque o browser/HML autenticado não estava disponível nesta rodada; nenhuma confirmação ou flag financeira foi alterada manualmente. | Executar confirmação terapeuta + paciente, retry/conflito e efeito financeiro pelo fluxo oficial. |

### Alteração de produto e migrations

O root cause reproduzido era que `apply_session_payment_state_v1` marcava o
pagamento como `failed/canceled`, mas deixava o booking em `pending_payment`.
Como esse estado ainda participa da exclusão do slot, Checkout expirado/falho
continuava bloqueando a agenda. A correção adiciona o estado terminal
`cancelled_by_payment`, executa a transição em trigger `AFTER UPDATE` do estado
financeiro, preserva motivo/auditoria e torna retries no-op. A transição é
protegida contra alteração manual fora do workflow de pagamento.

Migrations aplicadas no HML nesta rodada:

- `20260823170000_therapist_profile_media_draft.sql`
- `20260823210000_operational_cancellation_policy.sql`
- `20260824090000_align_public_search_next_slot.sql`
- `20260824100000_add_payment_cancelled_booking_status.sql`
- `20260824100100_release_booking_after_payment_failure.sql`

A lista remota confirmou alinhamento de `20260823100000` e das migrations
posteriores relevantes, sem pendências locais novas.

### Testes e evidências

- HML: Checkout test expirado, webhook automático processado, pagamento
  `canceled`, booking terminal `cancelled_by_payment`; nenhum novo pagamento
  foi usado para o diagnóstico.
- Local pgTAP: **83 arquivos / 1.739 testes, PASS**, incluindo
  `079_payment_failure_booking_release.sql` (8 asserções de transição,
  idempotência e liberação do slot) e `076_session_attendance_confirmation_lifecycle.sql`.
- Vitest: **167 arquivos / 658 testes, PASS**.
- Deno/Edge Functions: **174 testes, PASS**.
- TypeScript, lint e build de produção: **PASS**.
- Browser/IAB: indisponível; tentativa do backend Playwright nesta rodada
  falhou antes de abrir a página HML. Nenhum cookie, token ou secret foi
  persistido.

### Severidade e decisão

P0 restante: **nenhum identificado**. Não houve cobrança duplicada, acesso
indevido comprovado, segredo exposto ou corrupção de estado.

P1 restante: replay duplicado/atrasado dependente da configuração de webhook;
segundo paciente QA; fixture/harness Zoom adversarial; execução remota do
lifecycle bilateral; além dos P1 pré-existentes de CI remoto, e-mails críticos
e rotas de pagamento/comprovante do paciente.

**Impacto documental:** documentação atualizada; nenhuma alteração de rota,
produção ou arquitetura de provider.

Os cinco gates obrigatórios não estão todos verdes. A recomendação desta
rodada é **PHASE 2 FAIL**. A Fase 3 não foi iniciada e o TES não é declarado
Production Ready.

## Anexo — perfil Premium em HML (2026-08-23)

A qualificação do perfil QA `antonio-ferrari-e2e` isolou uma divergência de
runtime: temas Free salvavam, enquanto o tema Premium `Energia` retornava a
mensagem genérica de validação. A Edge Function HML
`therapist-profile-command` foi atualizada pelo processo oficial, sem produção
e sem alteração manual de banco.

Após o deploy, o fluxo real passou: selecionar Energia → salvar rascunho
(`Rascunho salvo.`) → enviar para revisão → iniciar e aprovar a análise no
Admin → tornar publicado e elegível. O perfil público voltou a aparecer com a
apresentação atualizada; os atributos visuais sanitizados confirmaram
`data-profile-theme=energia` e `data-theme-hero-background=energia`.

Também foi exercitada uma falha de contrato (281 caracteres na apresentação).
O salvamento não persistiu e a HML exibiu o motivo acionável
`Sua apresentação deve ter até 200 caracteres.`. Após recarregar, o perfil
publicado permaneceu íntegro.

| Checkpoint | Resultado |
| --- | --- |
| Premium theme save | **PASS** |
| Error reason shown | **PASS** |
| Review submission | **PASS** |
| Admin approval/publication | **PASS** |
| Public profile/theme visibility | **PASS** |

A aprovação administrativa é uma etapa obrigatória do TES; a ocultação durante
a análise foi observada e não foi tratada como defeito. Nenhum segredo, cookie,
token, documento ou dado privado foi registrado nesta evidência.

**Impacto documental:** documentação de homologação atualizada; nenhuma
alteração de rota, schema, migration ou produção.

## Retomada do merge dev-vini para dev-antonio — 2026-08-23

Status desta retomada: **NOT_READY**. Evidência histórica de HML não é usada
como substituto para uma execução no ambiente configurado da rodada atual.

| Gate | Resultado | Evidência sanitizada |
| --- | --- | --- |
| Integridade do merge | PASS | Sem arquivos não resolvidos; `git diff --check` passou. |
| pgTAP local completo | PASS | 78 arquivos, 1.692 asserções; os casos de bloqueio da agenda e isolamento do outbox foram corrigidos com fixtures versionadas. |
| Vitest local | PASS | `npm run test -- --pool=threads --maxWorkers=1`: 157 arquivos, 630 testes. Execução serial para preservar recursos. |
| Edge Functions | PASS | `npm run test:deno`: 171 testes, zero falhas. |
| UI de documentos Admin | PASS local | Playwright headed em 1440, 1024 e 390 px: sem sobreposição, overflow ou botões comprimidos. |
| UI de detalhe do encontro | PASS local | Playwright headed em desktop, tablet e mobile; a grade interna comprimida foi removida e o estado/status passou a fluir abaixo dos metadados. |
| Zoom local | PASS | `tests/e2e/zoom.spec.ts`, 3 cenários com cliques reais e contexts isolados; isto não substitui Zoom real HML. |
| Stripe HML runtime preflight | BLOCKED | `payments:phase3:runtime-preflight:hml` falhou fechado por configuração HML ausente; artefato sanitizado: `test-results/stripe-phase3/runtime-preflight-2026-08-23T16-31-12-000Z.json`. |
| Playwright HML / Zoom real HML | NOT_EXECUTED | Não havia URL compartilhada, personas efêmeras, credenciais ou confirmação manual momentânea no ambiente atual. Nenhuma operação externa foi iniciada. |
| Comparação visual Figma | NOT_EXECUTED | O acesso ao Figma não estava disponível nesta rodada; a validação local não a substitui. |

Condição para **PRODUCTION-READY**: repetir preflight HML com configuração
efêmera, executar o Golden Path Stripe test mode até webhook e estado
autoritativo, validar Playwright HML multi-contexto e, somente após confirmação
manual do endpoint, uma única sessão Zoom real curta. A comparação visual com
Figma também deve ser registrada. Até esses gates passarem, a qualificação
permanece **NOT_READY**.

## Fase 2.2 — Fechamento dos quatro gates bloqueados

Data: 2026-08-24, HML/test mode. O gate de Checkout/payment failed ou canceled
permanece PASS e não foi reaberto. Resultado dos quatro gates desta rodada:
**PHASE 2 FAIL**.

| Gate | Resultado | Evidência HML / root cause | Próxima ação |
| --- | --- | --- | --- |
| Duplicate/delayed webhook | **BLOCKED** | Endpoint platform/billing correto, separado do Connect, com 24 eventos. O 400 era assinatura feita com secret local divergente do secret remoto. O endpoint Stripe test HML foi rotacionado; o antigo foi removido, o novo ficou único/ativo e o secret foi injetado somente no Supabase HML. `stripe events resend` reenviou um evento test real, saiu com código 0 e o evento ficou com `pending_webhooks=0`, cobrindo a entrega atrasada; a CLI também impede nova retransmissão do mesmo request dentro de 24h. A convergência autoritativa em `stripe_webhook_events`/payment não foi lida nesta rodada por indisponibilidade do acesso Admin. | Usar retry oficial do provider ou janela permitida, ler DB sanitizado e repetir o mesmo `event.id` quando o contexto Admin estiver disponível. |
| Two-patient concurrency | **BLOCKED** | Duas identidades sintéticas foram aceitas pelo cadastro oficial HML, porém ambas retornaram `email_flow`; confirmação de e-mail não estava disponível. Nenhum booking, hold ou pagamento foi criado. | Disponibilizar confirmação automática ou mailbox QA oficial e executar dois contexts simultâneos. |
| Zoom before-host/reconnect | **BLOCKED** | Não foi criado booking novo nem reutilizada sessão histórica. Playwright headed encerrou o Chromium por permissão do Crashpad e o Browser/IAB retornou `NS_ERROR_FAILURE`. Sem browser funcional e fixture futura autorizada, o smoke não foi executado. | Liberar browser/harness visível e fixture Zoom futura. |
| Bilateral confirmation/financial lifecycle | **BLOCKED** | Migration `20260823100000` está aplicada no HML e o pgTAP 076 local cobre confirmação, retry, conflito e estados financeiros. O fluxo remoto não foi executado sem contexts autenticados; nenhuma confirmação ou flag financeira foi alterada manualmente. | Executar terapeuta + paciente pelo fluxo oficial e consultar `waiting_confirmation`, `waiting_safety_period` e efeito financeiro. |

### Alterações, fixtures e validações

- Nenhum código de produto foi alterado nesta fase.
- O endpoint Stripe platform/billing **test mode** foi rotacionado somente em
  HML, preservando URL e 24 eventos; produção não foi alterada.
- Duas identidades QA sintéticas foram iniciadas pelo cadastro oficial, sem
  dados pessoais reais. Como ficaram em `email_flow`, não foram usadas em
  reserva e não têm efeitos financeiros associados.
- Nenhum booking, hold, pagamento ou `video_session` novo foi criado.
- `stripe events resend`: evento test real, código 0; `livemode=false` e
  `pending_webhooks=0` (entrega confirmada, mas sem leitura DB autoritativa).
- Metadados Stripe: um endpoint platform/billing HML ativo com 24 eventos e
  um endpoint Connect separado com `account.updated`.
- Secrets HML: somente nomes foram conferidos; valores nunca foram impressos.
- Migrations HML permanecem alinhadas; `20260823100000` e o lifecycle de
  pagamento estão aplicados.
- Evidências locais preservadas: pgTAP 1.739, Vitest 658, Deno 174,
  typecheck/lint/build PASS.

P0 restante: **nenhum identificado**.

P1 restante: leitura autoritativa HML do replay Stripe; confirmação de e-mail
para segundo paciente QA; browser/fixture Zoom adversarial; confirmação
bilateral remota; além de CI, e-mails críticos e rotas de pagamento do
paciente.

Os quatro gates não estão todos verdes. A Fase 3 não foi iniciada.

## Fase 2.3 — Qualification Infrastructure Closure (2026-08-24)

Resultado: **PHASE 2 FAIL**. Esta rodada não reabriu o gate já aprovado de
Checkout falho/expirado. Não houve alteração de produção. A concorrência HML
criou somente o estado transitório autorizado para o teste e o limpou por
expiração do Checkout e webhook. O harness Zoom criou reservas QA pagas
controladas por Checkout Stripe test + webhook, usadas exclusivamente para o
gate Zoom, e a limpeza oficial terminou com cancelamento e reembolso no test
mode.

| Gate | Resultado | Evidência sanitizada / root cause | Próxima ação |
| --- | --- | --- | --- |
| Stripe replay authoritative evidence | **PASS** | Endpoint platform HML ativo e separado do Connect em Stripe test. Um `checkout.session.completed` real foi reenviado ao endpoint platform; o Stripe confirmou `livemode=false` e `pending_webhooks=0`. A inspeção Admin/HML retornou evento encontrado, `source=platform`, `processingStatus=processed`, registro único, uma tentativa, um pagamento `paid`, um booking `confirmed/paid` e correlações autoritativas verdadeiras. | Manter como regressão; não reabrir sem mudança no webhook ou regressão. |
| Two-patient concurrency | **PASS** | Dois BrowserContexts independentes autenticados com as identidades QA existentes enviaram simultaneamente o mesmo request de checkout para o mesmo slot público. O resultado foi exatamente um `200` e um `409 SLOT_CONFLICT`; o estado autoritativo convergiu para um único booking de teste, depois `cancelled_by_payment`/`canceled` após expiração do Checkout HML. Não houve pagamento confirmado; o booking criado pelo teste teve zero `video_session`; não restou hold ativo. Uma reserva histórica `cancelled_by_patient`/`refunded` e sua `video_session` foram excluídas da conclusão. A ação visual `Avançar para pagamento` permaneceu desabilitada na rota direta de preparação mesmo com sessão, slot e termos válidos; por isso a chamada foi exercitada pelo request do próprio BrowserContext e a divergência visual permanece registrada. | Manter como regressão; corrigir/investigar a divergência visual antes de declarar a experiência de reserva integralmente pronta. |
| Zoom adversarial/reconnect | **BLOCKED** | O share HML vigente permitiu Playwright headed e contexts isolados. O harness oficial criou/reutilizou reservas QA reais com Checkout Stripe test + webhook; o estado chegou a booking `confirmed`, pagamento `paid` e `video_session` `ready`, e a entrada real do terapeuta criou uma sessão Video SDK. Na execução automática, o paciente ficou na sala protegida; com fallback manual, a UI chegou a mostrar “O terapeuta já está na sala”, mas a evidência de um controle de entrada reconhecido não foi obtida. O harness foi ajustado para os rótulos atuais, porém não foi criada outra fixture paga para repetir o fluxo após esse ajuste. Refresh/reconnect/rejoin completos permanecem sem evidência. Todas as fixtures usadas foram canceladas e reembolsadas pela trilha oficial. | Corrigir/investigar a transição/controle de entrada paciente pós-host e repetir o runbook completo em uma única fixture autorizada. |
| Bilateral confirmation lifecycle | **BLOCKED** | Os contexts de paciente, terapeuta e Admin foram autenticados. A sessão paga usada no gate Zoom foi limpa antes deste fluxo; não houve execução remota de confirmação bilateral, retry/conflito ou efeito financeiro em `waiting_confirmation`/`waiting_safety_period`. | Provisionar/usar sessão QA paga separada e executar terapeuta + paciente pelo fluxo oficial, inspecionando estados e efeito financeiro. |

### Alterações e validações desta rodada

- `stripe-hml-preflight` recebeu somente a ação HML/Admin de inspeção
  sanitizada `inspect_webhook_event`; ela valida o formato do evento e retorna
  fingerprint, processamento e contagens/estados, nunca segredo, ID bruto,
  cookie ou token.
- A Edge Function foi publicada exclusivamente no projeto Supabase HML.
- `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/stripe-hml-preflight/webhook-inspection.test.ts`:
  **2/2 PASS**.
- `deno check --config supabase/functions/deno.json supabase/functions/stripe-hml-preflight/index.ts` e `git diff --check`: **PASS**.
- Login Admin HML e login terapeuta HML passaram; valores de credenciais não
  foram registrados.
- Auth Admin HML confirmou as duas identidades QA sintéticas existentes; as
  senhas de teste foram efêmeras e não foram registradas.
- A conta Stripe CLI correta foi confirmada por endpoint platform HML ativo,
  separado do Connect. O replay foi dirigido somente ao endpoint platform e a
  inspeção autoritativa não expôs IDs.
- O share HML vigente permitiu Playwright headed com contexts isolados para a
  concorrência. A camada visual da rota direta de preparação manteve o botão
  de avanço desabilitado apesar da sessão e do slot válidos; a evidência de
  contenção foi obtida pelo mesmo endpoint de checkout chamado pelos dois
  contexts. O follow-up visual está registrado e não foi mascarado.
- O harness oficial de Zoom foi executado com a reserva paga criada por
  Checkout Stripe test + webhook. Ele avançou até `therapist_join`, capturou
  a sessão real do Video SDK e encerrou-a no cleanup; o bloqueio ocorreu em
  `patient_join_ready`, antes de qualquer evidência adversarial/reconnect.
  Uma tentativa com fallback manual atualizou a UI para “O terapeuta já está
  na sala”, mas o observador ainda não reconhecia o controle atual; o harness
  foi ajustado para `Entrar na sala` e `Sala de espera do encontro`. Não houve
  nova fixture paga depois desse ajuste nesta rodada.
- O teste focal do harness Zoom ficou em **15/15 PASS**. Todas as reservas
  pagas usadas foram canceladas pela Edge Function oficial; como a política de
  cancelamento tardio não gerou refund automático, a limpeza foi concluída
  com refund Stripe test e webhooks assinados, convergindo para pagamento
  `refunded` e `refund_pending=false`, sem video session ativa.

P0 novo: **nenhum**. P1 restantes: os dois gates de fluxo restantes, além de CI remoto,
e-mails críticos e rotas de pagamento/comprovante do paciente. A divergência
visual do avanço da reserva é um follow-up de experiência, não uma aprovação
de pagamento. O bloqueio Zoom é de fluxo de produto/integração observado em
HML; não foi reexecutado após o último ajuste do harness para evitar outra
fixture paga sem autorização específica.

**Impacto documental:** documentação atualizada; a nova ação é limitada por
role Admin e hostname HML, sem rota, schema, RLS ou provider novo.

**PHASE 2 FAIL** — a Fase 3 não foi iniciada e o TES não é declarado
Production Ready.

## Fase 2.3 — Fechamento final dos gates remanescentes (2026-08-24)

Esta é a decisão final desta rodada. O Checkout falho/expirado não foi
reaberto como cenário HML; foi confirmado pela regressão focal. Foi criada
somente uma nova fixture paga em Stripe test para Zoom/confirmations. Não
houve alteração em produção.

| Gate | Resultado | Evidência sanitizada |
| --- | --- | --- |
| Failed/expired Checkout releases slot | **PASS** | pgTAP focal `079_payment_failure_booking_release.sql`: 8/8. A transição terminal `cancelled_by_payment`, auditoria, retry idempotente e novo hold no mesmo intervalo passaram. |
| Zoom adversarial/reconnect | **FAIL** | A sessão real chegou a host-first, liberação do paciente, refresh de paciente/terapeuta e reconnect de rede, preservando uma única `video_session`. O harness falhou em `patient_leave_rejoin` porque o botão ainda estava desabilitado durante a transição de carregamento; a sessão foi encerrada pelo cleanup oficial. Não há evidência completa de leave/rejoin de ambos e rejoin negado após encerramento. O bloqueio foi classificado como sincronização do harness, não como bug de produto confirmado. |
| Bilateral confirmation lifecycle | **PASS** | Na mesma fixture exata: paciente 200; retry idempotente 200; conflito de payload 409 `REQUEST_CONFLICT`; terapeuta 200. Estado final autoritativo: booking `completed`, duas confirmações `completed`, serviço `confirmed_by_therapist`, `service_confirmed_at` presente, transferência em `waiting_safety_period` e elegibilidade futura registrada. A Edge Function ausente no HML foi publicada somente nesse ambiente antes da execução. |

O `service_status` final `confirmed_by_therapist` é o valor canônico do enum
para a fonte `therapist_manual`; o harness foi ajustado para aceitar os três
estados confirmados canônicos (`auto_confirmed`, `confirmed_by_patient_review`
e `confirmed_by_therapist`). O pgTAP focal da migration
`20260823100000_session_attendance_confirmation_lifecycle.sql` passou 35/35.

**Impacto documental:** documentação atualizada. A Fase 3 não foi iniciada e
o TES não é declarado Production Ready.

**PHASE 2 FAIL** — o gate Zoom adversarial/reconnect não foi fechado nesta
rodada.

## Fase 2.4 — Separação entre agenda e watchdog Zoom (2026-08-25)

Esta rodada corrige o contrato temporal e a renderização bidirecional antes de
uma nova qualificação externa. Não houve escrita em HML ou produção, nem foi
aberta sessão real do Zoom.

| Gate | Resultado | Evidência sanitizada / pendência |
| --- | --- | --- |
| Agenda, primeira entrada e reconexão | **PASS local** | T-15, T+15 inclusivo, T+15+1 ms, reconexão previamente confiável e bloqueio em `scheduled_ends_at` cobertos por Deno, Vitest e pgTAP. |
| Duração exibida | **PASS local** | O contador usa exclusivamente `scheduledStartsAt`, `scheduledEndsAt` e o relógio do servidor. `hardEndsAt` não é mais apresentado como duração do encontro. |
| Encerramento normal e watchdog | **PASS local** | `end_scheduled` encerra no horário agendado; `end_hard_timeout` permanece proteção operacional. O watchdog é sincronizado como início efetivo + limite configurado e a migration recalcula somente sessões ativas. |
| Vídeo bidirecional | **PASS automatizado local** | SDK inicializado com múltiplos vídeos, containers independentes, estado remoto explícito, ressincronização limitada e recuperação de falha. O harness exige câmera do terapeuta visível ao paciente antes de ligar a câmera do paciente e revalida ambas as direções. |
| Ícones e copy | **PASS local** | Microfone e câmera representam o estado atual; nomes acessíveis descrevem a próxima ação. O detalhe distingue sala futura, aberta, terapeuta presente, janela expirada e falha operacional real. |
| Homologação canônica externa | **BLOCKED** | `homologation:zoom:local` concluiu os gates locais prévios, mas o endpoint público de webhook configurado respondeu HTTP 404 na validação do túnel. O fluxo interrompeu antes de abrir sessão real ou gerar custo. |
| Safari/iPhone e Chrome/Android reais | **NOT EXECUTED** | Viewport móvel em Chromium não substitui dispositivo real. Aceite externo continua obrigatório em telefone, desktop e tablet. |

Validações concluídas: Vitest **732/732**, Deno **200/200**, Zoom Video SDK
**18/18**, harness HML **15/15**, pgTAP Zoom focal **57/57**, novo pgTAP de
agenda/watchdog **9/9**, API mock sem chamada real, `typecheck`, `lint` e
`build` em **PASS**. O reset local do Supabase aplicou as duas migrations com
sucesso. Os processos temporários do harness foram encerrados.

A causa específica do valor `11:42` no registro histórico de HML não foi
confirmada nesta rodada, porque a auditoria somente leitura desse registro não
foi executada antes do bloqueio externo. O defeito de produto comprovado era a
exibição de `hardEndsAt` como duração; o valor histórico também pode refletir
snapshot ou versão implantada anterior e não deve ser atribuído sem evidência.

**Impacto documental:** documentação atualizada nas skills Zoom e de detalhe
do encontro, arquitetura, testes, troubleshooting, runbook e qualificação de
release.

**PHASE 2 FAIL** — a promoção permanece bloqueada até a sessão canônica HML e
os testes em dispositivos reais comprovarem vídeo bidirecional, reconexão,
encerramento agendado e watchdog.

## Fase 2.5 — Tolerância, reconexão e encerramento final Zoom (2026-08-25)

Esta rodada implementa localmente a chegada pontual em T+10, a reconexão após
saída individual e o encerramento definitivo pelo terapeuta nos cinco minutos
finais. Nenhuma alteração foi implantada em HML ou produção e nenhuma sessão
real do Zoom foi aberta.

| Gate | Resultado | Evidência sanitizada / pendência |
| --- | --- | --- |
| Tolerância e reconexão | **PASS automatizado local** | T-15, T+10 inclusivo, T+10+1 ms, versão da reserva e reconexão por chegada ou join confiável cobertos por Vitest e Deno. Lista, detalhe e sala aplicam o mesmo estado. |
| Saída individual | **PASS automatizado local** | `Sair` usa somente `leave(false)`, retorna à espera, atualiza o acesso e não abre feedback. A corrida de `connection-change: Closed` da própria saída é ignorada. |
| Encerramento final | **PASS automatizado local** | O controle é exclusivo do terapeuta, fica desabilitado antes de T-5, habilita pelo relógio autoritativo e usa `intent=end`; o navegador não chama `leave(true)`. Negativa mantém a chamada recuperável. |
| Feedback e confirmação | **PASS automatizado local** | Saída comum e fechamento precoce não liberam conclusão. Encerramento final confirmado ou `scheduled_ends_at` preservam a autoridade do read model bilateral existente. |
| Edge/Deno e Zoom focal | **PASS** | `npm run test:deno`: 201/201; `npm run test:zoom`: Deno Zoom 18/18 e Vitest Zoom 35/35. |
| UI e contratos focados | **PASS** | Suites de booking, detalhe, lista, sala e controles: 54/54 na rodada focal inicial; regressão ampliada de booking/detalhe/lista: 50/50; regressão final de sala/lista/janela: 36/36. |
| API mock | **PASS** | `zoom:video-sdk:api:mock` concluiu sem chamada real ao Zoom. |
| Typecheck, lint e build | **PASS** | TypeScript sem erro; políticas visual/online-only e ESLint sem aviso; Next build concluído. O build registrou tentativas locais bloqueadas para `127.0.0.1:54321`, mas gerou as 119 páginas e terminou com sucesso. |
| Migration e pgTAP 088 | **NOT EXECUTED** | A migration e o arquivo pgTAP com 21 asserções estão versionados, porém o daemon Docker local não respondeu a `supabase status`/`docker inspect`; os processos de diagnóstico travados foram encerrados. Nenhuma asserção de banco é declarada aprovada. |
| `homologation:zoom:local` | **BLOCKED** | Não iniciado após a indisponibilidade do daemon, pois o orquestrador depende do Supabase/Docker e não seria seguro prosseguir para Stripe test ou Zoom real sem o gate de schema. |
| HML e dispositivos reais | **NOT EXECUTED** | Migration, Edge Function e aplicação não foram implantadas. Safari/iPhone, Chrome/Android, desktop e tablet reais permanecem obrigatórios após os gates locais. |

Antes de HML: restaurar o Docker local, executar serialmente a migration e o
pgTAP 088, confirmar cron local inativo, rodar `homologation:zoom:local` e só
então implantar na ordem migration → Edge Function → aplicação, comprovando
que não há sessão ativa. Em HML, repetir saída por suporte, voltar, refresh e
outro dispositivo, primeira chegada em T+10+1 ms, encerramento em T-5 e
feedback bilateral.

**Impacto documental:** documentação atualizada nas skills Zoom e do detalhe,
arquitetura, testes, troubleshooting, runbook, inventário de páginas e
qualificação de release.

**PHASE 2 FAIL** — a implementação local está concluída, mas promoção continua
bloqueada por pgTAP, homologação canônica, implantação HML controlada e aceite
em dispositivos reais.
