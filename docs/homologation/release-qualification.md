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
`Como funciona` no cabeçalho, no menu mobile e no rodapé, seguindo o Figma
`Projeto TES - Copy`, node `14845:668`; refinamento posterior do hero sem CTA,
da tipografia editorial leve, da proteção contra palavras viúvas e da mídia
de alta qualidade nas superfícies públicas com assets editoriais.

| Gate                         | Resultado | Evidência segura                                                                                                                        |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Calibration visual           | PASS      | Comparação local em 1920×1080, 1440×1000, 1024×900 e 390×844; hero inicia após o cabeçalho, não possui CTA e usa IvyPresto Display Light Italic. A sequência mobile foi revisada integralmente, sem critério eliminatório. |
| Responsividade e assets      | PASS      | `tests/e2e/public-about.spec.ts`: 6/6 cenários Chromium, sem overflow horizontal, sem imagem local quebrada; hero, cards e mídias editoriais públicas usam WebP em `q=95`, incluindo a versão restaurada de alta resolução do mockup de plataforma. |
| Navegação pública            | PASS      | Teste E2E confirmou `/sobre-nos` no cabeçalho desktop, menu mobile e rodapé; testes unitários focais 6/6.                               |
| TypeScript                   | PASS      | `npm run typecheck`.                                                                                                                    |
| Lint                         | PASS      | `npm run lint`, incluindo políticas visual e online-only, sem warning ou erro.                                                          |
| Build                        | PASS      | `npm run build`: 108 rotas geradas; `/sobre-nos` prerenderizada como página estática.                                                   |
| Browser oficial do Codex/HML | BLOCKED   | O backend do Browser oficial continua ausente; a evidência desta rodada é local e headless via Chromium/Playwright.                     |

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
