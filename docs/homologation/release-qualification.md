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
