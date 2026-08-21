# TES — Release Readiness Baseline (Fase 0)

Data: 2026-08-21
Commit inspecionado: `ffad0b2b` (worktree também contém alterações de outras frentes, preservadas)  
Ambientes: local, Supabase HML, Stripe test-mode parcial, Zoom local configurado e HML público  
Decisão da Fase 0: **PHASE 1 NOT READY**
Decisão após Fase 0.5: **PHASE 1 READY**

## Como ler este baseline

Este documento registra evidência desta rodada, não aprovação de produção.
`PASS` significa que o gate indicado foi comprovado no ambiente indicado;
`FAIL` significa que foi reproduzido um problema; `BLOCKED` que falta acesso,
configuração ou pré-condição externa; `NOT_TESTED` que não foi exercitado.

Implementado não equivale a testado. Teste local não equivale a HML. HML não
equivale a fornecedor externo real em test mode.

## Atualização Fase 0.5 — Unblock Golden Path

Data: 2026-08-21

Esta seção prevalece sobre os findings F0-05, F0-10 a F0-12, F0-16, F0-21 e
F0-30 abaixo, que são preservados como fotografia histórica da Fase 0.
Nenhuma cobrança, Checkout, transferência, refund, booking ou sessão Zoom foi
executado nesta fase.

| Gate                     | Resultado | Evidência sanitizada                                                                                                                                                                                           | Root cause / resolução                                                                                                                                           |
| ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth bypass fail-closed  | **PASS**  | Deno: 17/17 no foco e 156/156 na suíte; as três funções de login foram implantadas em HML; login normal HML continuou funcional.                                                                               | O helper assumia `true` na ausência de flag. Agora exige flag booleana explícita e URL Supabase local; HML/produção falham fechados mesmo com `MASTER_PASSWORD`. |
| Stripe HML preflight     | **PASS**  | `npm run payments:phase3:runtime-preflight:hml`: 10/10 checks; Stripe test, catálogo (2 preços), webhooks plataforma/Connect, 11 functions, estado de pagamento, fixture pública com slot, Connect e repasses. | O harness local dependia de service-role efêmera ausente. Novo preflight Admin-only roda em HML com secrets do runtime e retorna somente evidência sanitizada.   |
| Multi-context Playwright | **PASS**  | Chromium HML: 1/1; paciente, terapeuta e Admin simultâneos em BrowserContexts distintos.                                                                                                                       | IAB compartilha sessão por abas. O novo smoke cria três cookie jars e storages independentes e não grava trace, vídeo, screenshot ou state.                      |
| HML migration alignment  | **PASS**  | `supabase migration list --linked` mostra local/remoto iguais, inclusive `20260821142516`.                                                                                                                     | A migration de notificações foi sincronizada por outro processo durante a rodada; não foi aplicada por esta Fase 0.5. Ela não era requisito do Golden Path.      |
| Known local tests        | **PASS**  | Vitest 142 arquivos/555 testes; Deno 156/156; pgTAP 68 arquivos/1.484; typecheck, lint e build (110 rotas).                                                                                                    | O fixture de agenda tinha data absoluta expirada; agora usa data relativa, sem alterar regra de negócio.                                                         |

### Comportamento comprovado do bypass

1. **Runtime remoto com `MASTER_PASSWORD`:** antes da correção, paciente e
   terapeuta podiam usar o fallback porque o helper assumia bypass ativo.
2. **HML:** o secret existe no runtime HML, e o código antigo o tornava
   utilizável. As funções HML agora implantadas calculam bypass como `false`
   fora de localhost, independentemente da presença do secret.
3. **Produção:** o código corrigido impede o bypass por host remoto e por
   default fail-closed. Produção não foi consultada nem alterada nesta fase;
   portanto a confirmação de rollout produtivo pertence ao Release Candidate.
4. **Proteção:** paciente e terapeuta usam
   `MASTER_PASSWORD_BYPASS_ENABLED=true` somente com URL Supabase local; Admin
   conserva flag própria e a mesma restrição local. Flag ausente, inválida ou
   URL remota não autentica por `MASTER_PASSWORD`.

### Migration `20260821142516_shell_notifications.sql`

Classificação: **NOT REQUIRED FOR PHASE 1**. Ela adiciona `event_key`, índice
de idempotência e gatilhos para notificações de pagamento já confirmado,
mensagens, suporte e catálogo. Não é chamada por hold, Checkout, webhook,
booking, Zoom, ledger nem autenticação. O alinhamento atual em HML é PASS; a
execução não foi atribuída a esta rodada.

## Fase 1 — Tentativa controlada do Golden Path HML

Data: 2026-08-21
Decisão desta tentativa: **PHASE 1 FAIL**

Foi implantada somente em HML, com autorização explícita, uma extensão
Admin-only do preflight existente. Ela falha fechada fora do host HML e serve
exclusivamente para criar e remover a regra temporária de disponibilidade da
fixture, sem retornar secrets, tokens, cookies ou chaves.

| ID    | Checkpoint                   | Status     | Evidência sanitizada                                                                                               | Estado autoritativo                                 | Observação                                    |
| ----- | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| GP-01 | Public discovery             | PASS       | Perfil público da fixture renderizou terapeuta, serviço bookable e preço canônico.                                 | Projeção pública HML                                | Não foi alterada.                             |
| GP-02 | BrowserContexts              | PASS       | Paciente, terapeuta e Admin autenticaram simultaneamente em cookie jars isolados.                                  | Sessões independentes no navegador                  | Reutiliza o smoke F0.5.                       |
| GP-03 | Fixture T-15                 | PASS       | Harness criou uma única regra temporária, obteve slot futuro, e liberou regra/configuração ao encerrar.            | Slot RPC autoritativo                               | Sem dados persistidos no relatório.           |
| GP-04 | Booking initiation           | BLOCKED    | Uma execução interrompida no Checkout deixou uma reserva de pagamento pendente ocupando a janela curta da fixture. | Admin HML mostra a reserva como pagamento pendente. | Não foi cancelada, alterada ou reutilizada.   |
| GP-05 | Stripe Checkout              | NOT_TESTED | Não há evidência conclusiva de pagamento desta rodada.                                                             | Nenhum pagamento pago atribuível ao cenário novo.   | Não inferir sucesso pelo navegador.           |
| GP-06 | Webhook/payment/booking      | NOT_TESTED | Sem Checkout novo concluído de forma controlada.                                                                   | Não validado.                                       | Depende de GP-05.                             |
| GP-07 | Zoom host-first/conclusão    | NOT_TESTED | Sem booking novo pago dentro de T-15.                                                                              | Não validado.                                       | Não abrir sessão Zoom sem pagamento canônico. |
| GP-08 | Financeiro/Admin/invariantes | NOT_TESTED | Apenas consulta Admin de diagnóstico; sem cenário atribuído.                                                       | Não validado.                                       | Depende de GP-05 a GP-07.                     |

Root cause: o slot T-15 é propositalmente exclusivo durante a duração integral
do serviço. A reserva pendente criada pela execução interrompida ocupa a única
janela curta; o harness recusou corretamente criar cenário sobreposto. Não foi
feita limpeza destrutiva, atualização SQL, cancelamento manual ou reutilização
da reserva anterior.

Classificação: **P1 de qualificação HML**. Não é um finding de produção nem um
P0 do produto; entretanto impede concluir a evidência obrigatória da Fase 1.
Retomar somente após a expiração canônica da reserva pendente ou usando uma
nova janela oficialmente preparada que não conflite com ela.

### Retry Fase 1

Data: 2026-08-21
Decisão: **PHASE 1 FAIL**

| Checkpoint                      | Resultado  | Evidência                                                                 |
| ------------------------------- | ---------- | ------------------------------------------------------------------------- |
| Fixture clean                   | FAIL       | Precheck HML Admin-only retornou fixture_slot_not_clean antes da reserva. |
| Booking initiation              | NOT_TESTED | Nenhum novo booking, hold ou Checkout foi criado.                         |
| Stripe Checkout até invariantes | NOT_TESTED | Dependem de fixture clean.                                                |

O precheck consulta o slot autoritativo após aplicar temporariamente a regra de
disponibilidade e restaura essa regra/configuração em qualquer saída. A recusa
ocorre porque não há intervalo limpo na janela escolhida; a reserva pendente da
tentativa anterior permanece somente observada, sem qualquer mutação manual.

### Busca ampliada de fixture

O precheck HML foi repetido em modo somente leitura para 24 a 72 horas, primeiro
nos serviços ativos do terapeuta original e depois nas fixtures públicas
elegíveis. Resultado: **NO CLEAN HML FIXTURE AVAILABLE**. Nenhuma candidata
reuniu simultaneamente slot autoritativo disponível e estado Connect suficiente.
Não foram alteradas regras, reservas, holds, pagamentos, sessões de vídeo ou a
reserva pendente anterior.

## Fase 1A — Fixture oficial de homologação

Data: 2026-08-21
Decisão: **GOLDEN PATH FIXTURE READY**

Root cause do bloqueio anterior: a qualificação dependia de slots casuais da
fixture pública e encontrou uma reserva pendente em uma janela exclusiva. O
motor de agenda recusou corretamente a sobreposição. Isso é um bloqueio de
qualificação HML, não um defeito comprovado no Golden Path.

Foi formalizada em HML/test a fixture existente e explicitamente identificada
para E2E, sem criar dados pessoais ou alterar a reserva pendente anterior:

- `fixture_type`: `golden_path_hml`;
- terapeuta público QA: slug `antonio-ferrari-e2e`;
- serviço público QA: `Reiki online E2E`, 50 minutos, R$ 120,00;
- timezone: `America/Sao_Paulo`;
- seleção determinística: chamar o preflight HML Admin-only com `find_clean` e
  usar `slot` como candidato A e `fallbackSlots` como B/C; o seletor exige
  separação pela duração e buffers canônicos.

A disponibilidade de sábado, 09:00–17:00, foi adicionada pela própria tela
autenticada de agenda do terapeuta e salva pelo comando versionado
`therapist-schedule-update`. Nenhum booking, hold, pagamento, vídeo, serviço,
perfil ou estado Connect foi criado/atualizado manualmente.

### Matriz de readiness da fixture

| Gate                                       | Resultado | Evidência sanitizada                                                                                           |
| ------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| Therapist approved e publicable            | PASS      | O perfil público QA renderizou como verificado e disponível para reserva.                                      |
| Service active e preço canônico            | PASS      | Perfil público mostrou serviço online ativo de 50 min por R$ 120,00.                                           |
| Clean future slot A                        | PASS      | 22/08/2026 14:00 BRT; precheck autoritativo sem booking/hold/payment/video session/restrição.                  |
| Clean future slot B                        | PASS      | 22/08/2026 15:00 BRT; independente de A pela duração e buffers canônicos.                                      |
| Clean future slot C                        | PASS      | 22/08/2026 16:00 BRT; independente de A/B pela duração e buffers canônicos.                                    |
| Patient QA                                 | PASS      | Smoke Playwright HML autenticou a persona paciente em contexto isolado.                                        |
| Admin QA                                   | PASS      | Smoke Playwright HML autenticou a persona Admin em contexto isolado.                                           |
| Stripe test mode                           | PASS      | Preflight HML confirmou test mode, API e dois preços Billing ativos.                                           |
| Connect readiness                          | PASS      | Conta da fixture exibiu transferências ativas e sincronização recente; preflight HML confirmou Connect pronto. |
| Signed webhook readiness                   | PASS      | Preflight HML confirmou webhooks de plataforma e Connect habilitados com eventos exigidos.                     |
| No existing booking/payment/video conflict | PASS      | Precheck Admin-only consultou o slot engine e confirmou ausência de conflito para A/B/C.                       |

O precheck HML retorna somente dados de operação necessários, sem secrets,
tokens, cookies, URLs assinadas ou identificadores Stripe completos. Não houve
Checkout, cobrança, webhook recebido, booking novo, Zoom ou transferência nesta
fase; esses continuam exclusivamente na Fase 1.

## Resumo executivo

- A base local compila e os contratos de banco/Edge Functions passam: TypeScript,
  lint, build, Deno e pgTAP estão verdes.
- HML existe, está ativo, responde publicamente e possui as Edge Functions
  críticas ativas. As migrations coincidem até `20260820194000`; a migration
  local `20260821142516_shell_notifications.sql` ainda não foi aplicada.
- Não há evidência desta rodada de Checkout Stripe, webhook assinado, booking
  pago, Zoom real, Connect, refund, transferência ou e-mail Hostinger em HML.
- Há um P0 de autenticação: logins de paciente e terapeuta aceitam
  `MASTER_PASSWORD` como fallback quando a senha normal falha, pois o helper
  assume o bypass como habilitado se o chamador não o informar. O endpoint Admin
  é diferente: exige flag explícita e Supabase local. Portanto, o mecanismo de
  bypass não é impossível em produção para as duas primeiras personas.
- O contrato de rotas declara páginas de pagamentos e configurações do paciente
  que não existem no App Router. O detalhe de encontro ainda gera uma URL de
  comprovante sem rota correspondente.

Readiness aproximado, por domínio (não é uma métrica de qualidade):

| Domínio                 | Estimativa | Leitura                                                                                                  |
| ----------------------- | ---------: | -------------------------------------------------------------------------------------------------------- |
| Base local e banco      |       ~85% | Gates locais fortes; suíte unitária completa não fecha e há dívida de formato/lint DB.                   |
| Segurança               |       ~65% | RLS/ACL local comprovados, mas o bypass de senha é P0 e HML não foi atacado.                             |
| HML/Supabase            |       ~60% | Projeto, migrations majoritárias e functions ativos; secret/config/job não confirmados.                  |
| Stripe/Connect          |       ~30% | Implementado e functions ativas; preflight HML não recebeu as variáveis seguras necessárias.             |
| Zoom Video SDK          |       ~45% | Contratos e ambiente local preparados; não houve sessão real HML.                                        |
| E-mail transacional     |       ~45% | Outbox/retry e functions existem/testam localmente; sender, secrets e dispatch real HML não confirmados. |
| Rotas/jornadas críticas |       ~60% | Público HML abre; reserva existe; há buracos pós-pagamento do paciente.                                  |
| Browser/E2E HML         |       ~35% | Navegador abre HML publicamente; faltam personas/credenciais controladas e contexts autenticados.        |

## Release Readiness Board

| ID    | Área             | Persona                  | Gate                                      | Ambiente            | Status     | Evidência                                                                                                                                                                                                                            | Severidade | Próxima ação                                                                              |
| ----- | ---------------- | ------------------------ | ----------------------------------------- | ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------- |
| F0-01 | Dependências     | Engenharia               | Árvore Node instalada                     | local               | PASS       | `npm ls --depth=0 --omit=optional` saiu 0; há 5 pacotes extraneous de `sharp`/WASM.                                                                                                                                                  | P2         | Reproduzir em CI com `npm ci`; não limpar `node_modules` nesta fase.                      |
| F0-02 | TypeScript       | Engenharia               | Typecheck                                 | local               | PASS       | `npm run typecheck` saiu 0.                                                                                                                                                                                                          | P2         | Manter no CI.                                                                             |
| F0-03 | Lint             | Engenharia               | ESLint + políticas TES                    | local               | PASS       | `npm run lint`: políticas visual e online-only sem violações; ESLint sem erros.                                                                                                                                                      | P2         | Planejar migração de `next lint`, que está depreciado.                                    |
| F0-04 | Formatação       | Engenharia               | Prettier global                           | local               | FAIL       | `npm run format:check` listou extensa dívida preexistente e não concluiu dentro do limite de execução desta auditoria; não foi feita formatação global.                                                                              | P2         | Corrigir em mudança isolada; não bloquear Fase 1 por este item.                           |
| F0-05 | Unitário         | Engenharia               | Vitest completo                           | local               | PASS       | Fixture temporal passou a usar data relativa; `npm run test`: **142 arquivos, 555 testes, PASS**.                                                                                                                                    | P2         | Manter a suíte sem datas absolutas em fixtures de formulário.                             |
| F0-06 | Edge Functions   | Engenharia               | Deno                                      | local               | PASS       | `npm run test:deno`: **156 passed, 0 failed**. Inclui os regressivos do bypass fail-closed.                                                                                                                                          | P2         | Manter no CI.                                                                             |
| F0-07 | Banco/RLS        | Todas                    | pgTAP                                     | local               | PASS       | `npx supabase test db --local`: **68 arquivos, 1.484 testes, PASS**.                                                                                                                                                                 | P1         | Reexecutar a suíte contra HML após credencial read-only apropriada.                       |
| F0-08 | Banco            | Engenharia               | `supabase db lint`                        | local               | PASS       | Saiu 0 com **12 avisos**: 8 de volatilidade declarada e 4 de variáveis não usadas.                                                                                                                                                   | P2         | Corrigir em hardening SQL qualificado.                                                    |
| F0-09 | Build            | Todas                    | Build de produção                         | local               | PASS       | `npm run build`: **110 rotas** geradas, compilação/tipos concluídos.                                                                                                                                                                 | P1         | Executar o mesmo artefato no deploy HML.                                                  |
| F0-10 | CI               | Engenharia               | Workflow GitHub                           | repositório         | FAIL       | Execuções remotas foram observadas; a mais recente falhou em `docs/product/integration-map.md` no check de Prettier de arquivos alterados. Não houve execução verde para a revisão atual.                                            | P1         | Formatar o arquivo do owner e observar execução remota verde antes do RC.                 |
| F0-11 | Supabase HML     | Todas                    | Projeto e migrations até `20260821142516` | HML                 | PASS       | `supabase migration list --linked` confirma alinhamento local/remoto inclusive `20260821142516`.                                                                                                                                     | P2         | Manter verificação no deploy.                                                             |
| F0-12 | Supabase HML     | Todas                    | Drift de migration                        | HML                 | PASS       | Não há drift na listagem atual. A sincronização de notificações ocorreu fora desta rodada.                                                                                                                                           | P2         | Registrar owner/janela do deploy que realizou a sincronização.                            |
| F0-13 | Edge Functions   | Todas                    | Functions críticas implantadas            | HML                 | PASS       | `supabase functions list` mostra ativas `session-booking-checkout`, Stripe Billing/Connect, Zoom, outbox e funções de payout.                                                                                                        | P1         | Validar versões contra a revisão liberada antes do Golden Path.                           |
| F0-14 | RLS/ACL          | Paciente/Terapeuta/Admin | Isolamento e RPCs                         | local               | PASS       | pgTAP cobre paciente A×B, terapeuta A×B, acesso Admin, RPC financeira e `reserve_booking_hold_v1`; migration de hardening está aplicada em HML.                                                                                      | P0         | Executar ataque controlado equivalente em HML na Fase 2.                                  |
| F0-15 | Views/RPC        | Público/privado          | Views, `SECURITY DEFINER`, grants         | local               | PASS       | `044_security_authorization_surface.sql` passou; allowlist pública, views sem DML a `anon`/`authenticated`, hold só para `service_role`.                                                                                             | P0         | Revalidar após qualquer migration que recrie view/função.                                 |
| F0-16 | Segurança        | Paciente/Terapeuta/Admin | `MASTER_PASSWORD`                         | código/HML          | PASS       | Helper agora é fail-closed; cliente, terapeuta e Admin exigem flag explícita e host local. Deno cobre local permitido, HML/produção remotos e secret ausente; funções HML foram implantadas.                                         | P0         | Exigir esta revisão no próximo deploy de produção e revalidar no RC.                      |
| F0-17 | Segurança        | Admin                    | `ADMIN_MASTER_PASSWORD_BYPASS_ENABLED`    | código              | PASS       | Admin só habilita bypass se flag booleana válida **e** host Supabase é `localhost`/`127.0.0.1`.                                                                                                                                      | P1         | Cobrir endpoint completo em HML com flag ausente.                                         |
| F0-18 | Segurança        | Todas                    | Secrets no front-end                      | código rastreado    | PASS       | Varredura não encontrou secret Supabase/Stripe/Zoom/e-mail no `src/`; `.env` local não é rastreado e exemplos usam placeholders.                                                                                                     | P0         | Repetir em CI com scanner de secrets.                                                     |
| F0-19 | Segurança        | Auth                     | Leaked Password Protection                | HML                 | NOT_TESTED | `docs/security/authorization-surface-hardening.md` registra "preparado/documentado, não ativado".                                                                                                                                    | P2         | Ativar primeiro em HML e testar signup/login/reset.                                       |
| F0-20 | Segurança        | Banco                    | `search_path` legado                      | local               | FAIL       | A documentação identifica funções `SECURITY DEFINER` legadas com `search_path=public`; não houve recriação qualificada.                                                                                                              | P2         | Hardening por função, com objetos qualificados e pgTAP.                                   |
| F0-21 | Stripe           | Terapeuta/Paciente/Admin | Readiness HML sem mutação                 | HML/test            | PASS       | Preflight HML Admin-only: Stripe test, API, 2 preços Billing, webhooks plataforma/Connect, 11 functions, estado de pagamento, fixture pública com slot, Connect e repasses passaram. Evidência não contém secrets nem IDs sensíveis. | P0         | Usar o preflight antes de executar o Golden Path.                                         |
| F0-22 | Stripe           | Paciente                 | Checkout → webhook → pagamento            | HML/test            | NOT_TESTED | Scripts existem, mas não foi criada cobrança nesta fase.                                                                                                                                                                             | P1         | Fase 1: cenário aprovado com webhook assinado e evidência de `session_payments=paid`.     |
| F0-23 | Stripe           | Terapeuta                | Billing/Checkout e assinatura             | HML/test            | NOT_TESTED | Functions de Billing ativas; sem Checkout real/test webhook nesta rodada.                                                                                                                                                            | P1         | Fase 1: Premium/Premium Plus e reconciliação autoritativa.                                |
| F0-24 | Stripe Connect   | Terapeuta/Admin          | Onboarding, sync e repasse                | HML/test            | NOT_TESTED | Functions Connect/payout ativas; estado da conta e capabilities não foram consultados.                                                                                                                                               | P1         | Validar hosted onboarding e sync server-side antes do launch.                             |
| F0-25 | Zoom             | Paciente/Terapeuta       | Configuração/harness                      | local               | PASS       | `npm run zoom:video-sdk:env` confirmou chaves/limite configurados e `ALLOW_REAL_ZOOM=true`; contrato HML: **15/15** testes.                                                                                                          | P1         | Não interpretar como sessão real.                                                         |
| F0-26 | Zoom             | Paciente/Terapeuta       | Video SDK, webhook e host-first           | HML/fornecedor real | BLOCKED    | Sem booking pago por webhook Stripe, URL/share HML controlada e personas, o harness não pode abrir a única sessão curta autorizada.                                                                                                  | P1         | Fase 1: executar o runbook HML com contexts separados e evidência de join/leave/webhooks. |
| F0-27 | E-mail           | Paciente/Terapeuta/Admin | Outbox, retry e recovery                  | local               | PASS       | pgTAP de outbox passou; Deno cobre Hostinger, templates, limites e falha fechada. A migration agenda recovery por `pg_cron`.                                                                                                         | P1         | Confirmar schedule, Vault, sender e dispatch em HML.                                      |
| F0-28 | E-mail           | Paciente/Terapeuta/Admin | Hostinger/sender/secrets reais            | HML/fornecedor real | BLOCKED    | Function `email-outbox-dispatch` está ativa, mas a listagem de nomes de secrets não retornou dados úteis e não houve envio HML.                                                                                                      | P1         | Validar registry/sender e um envio controlado na Fase 3.                                  |
| F0-29 | Browser          | Público                  | HML pública                               | HML                 | PASS       | Navegador oficial abriu `https://hml.terapeutaeusou.com.br/` e DOM/navegação pública renderizaram.                                                                                                                                   | P1         | Capturar smoke público por viewport na Fase 4.                                            |
| F0-30 | Browser/E2E      | Paciente/Terapeuta/Admin | Contexts autenticados independentes       | HML                 | PASS       | `hml-multi-context-auth.spec.ts` passou em Chromium: três BrowserContexts simultâneos, cookie/localStorage/sessionStorage independentes e destinos `/app`, `/terapeuta`, `/admin`.                                                   | P0         | Reutilizar o harness no Golden Path; manter credenciais somente no runtime.               |
| F0-31 | Público          | Público                  | Discovery → Match → terapias → perfil     | HML                 | NOT_TESTED | Página pública HML e links de discovery renderizam; Match/catálogo/perfil não foram percorridos ponta a ponta.                                                                                                                       | P1         | Fase 1: smoke público antes da reserva.                                                   |
| F0-32 | Paciente         | Paciente                 | Pagamentos e comprovante                  | App Router          | FAIL       | `routes.ts` e inventários declaram `/app/pagamentos*`; não há páginas correspondentes. `booking-detail.queries.ts` ainda fabrica `/app/pagamentos/comprovantes/:bookingId`, também inexistente.                                      | P1         | Definir rota/UX canônica ou remover o destino com teste de rota.                          |
| F0-33 | Paciente         | Paciente                 | Configurações                             | App Router          | FAIL       | `/app/configuracoes` e quatro subrotas constam em docs/rotas, mas não existem em `src/app`.                                                                                                                                          | P2         | Classificar no roadmap; não é condição do Golden Path inicial.                            |
| F0-34 | Paciente         | Paciente                 | Aliases de encontros                      | App Router          | PASS       | `/app/sessoes*` existe como redirects em `next.config.mjs` para `/app/encontros*`.                                                                                                                                                   | P2         | Manter teste de contrato de redirects.                                                    |
| F0-35 | Pessoa terapeuta | Terapeuta                | Login e dashboard                         | HML                 | PASS       | Credencial normal chegou a `/terapeuta`; navegação e plano Premium Plus renderizaram, sem erros de console. Cadastro, agenda, serviços, Zoom e financeiro permanecem `NOT_TESTED`.                                                   | P1         | Cobrir no Golden Path e failure paths.                                                    |
| F0-36 | Administração    | Admin                    | Login e dashboard                         | HML                 | PASS       | Credencial normal chegou a `/admin`; dashboard e navegação renderizaram, sem erros de console. Módulos operacionais permanecem `NOT_TESTED`.                                                                                         | P1         | Executar smoke Admin somente leitura na Fase 3.                                           |

## P0 existentes

**Nenhum P0 remanescente para iniciar a Fase 1.** F0-16, F0-21 e F0-30 foram
fechados na Fase 0.5. Isso não constitui aprovação de produção: o rollout da
correção de autenticação em produção continua obrigatório antes do RC.

## P1 existentes

- F0-10: CI remoto executa, mas a execução mais recente falha em formatação de
  arquivo alterado por outra frente; precisa de um run verde antes do RC.
- F0-22: Golden Path financeiro ainda não executado; é o alvo principal da Fase 1.
- F0-23/F0-24: assinatura e Connect sem prova externa HML.
- F0-26: Zoom real HML é o próximo gate do Golden Path.
- F0-27/F0-28: operação de e-mail real HML sem prova.
- F0-32: pagamentos/comprovante do paciente apontam para rotas inexistentes.
- Jornadas além dos dashboards de terapeuta/Admin permanecem sem smoke HML.

## Itens bloqueados por infraestrutura/configuração externa

- Configuração atual de webhook Zoom na Build Platform e autorização manual
  para uma sessão curta.
- Confirmação de sender Hostinger, secrets, Vault e jobs de dispatch/recovery
  em HML.

## Pós-launch explícito

- Formatação global preexistente (F0-04).
- Leaked Password Protection, depois de validada em HML (F0-19).
- Hardening gradual de `search_path` legado (F0-20).
- Configurações completas do paciente (F0-33), desde que não sejam prometidas
  no launch sem alternativa aprovada.

## O que precisa estar preparado para iniciar a Fase 1

1. Fixture pública de terapeuta com serviço/slot e uma persona paciente
   confirmada; persona terapeuta aprovada e, para o percurso administrativo,
   uma persona Admin isolada.
2. Webhooks Stripe test apontando para HML e capacidade de observar a entrega
   assinada e o replay idempotente.
3. Zoom Marketplace/webhook configurado e validado para HML, com autorização
   manual para uma única sessão de 30–60 segundos após pagamento canônico.

## Próximas fases propostas

### Fase 1 — Golden Path real

Discovery → reserva → Stripe test Checkout → webhook assinado → booking pago
→ Zoom host-first → conclusão → read models financeiro/Admin. Evidência deve
trazer IDs mascarados, estados autoritativos e replay idempotente.

#### Plano operacional preparado (não executado nesta fase)

1. **Personas:** paciente, terapeuta da fixture pública e Admin HML, cada qual
   em BrowserContext separado; credenciais somente em variáveis efêmeras.
2. **Booking:** um único slot futuro da fixture pública `antonio-ferrari-e2e`.
   O valor será o `service_price_cents` canônico publicado no momento do
   preflight; não alterar preço nem criar dado mock para o cenário.
3. **Sequência:** discovery/perfil → hold autoritativo → Checkout Stripe test
   → pagamento de teste → webhook assinado → `session_payments=paid` → booking
   confirmado → `video_sessions` criada → terapeuta entra → paciente recebe
   acesso host-first → encerramento curto.
4. **Checkpoints/evidência sanitizada:** IDs mascarados e apenas estados de
   `booking_holds`, `bookings`, `session_payments`, `video_sessions`, ledger,
   read model financeiro do terapeuta e leitura Admin. Não registrar token,
   cookie, URL de Checkout, JWT Zoom ou webhook secret.
5. **Financeiro/Admin:** confirmar que Stripe/webhook/banco, e não o retorno
   do browser, determinam pagamento; verificar uma única entrada no ledger e
   elegibilidade de repasse sem efetivar payout.
6. **Cleanup:** encerrar contexts, descartar credenciais efêmeras, registrar
   identificadores mascarados no relatório e decidir explicitamente se a
   fixture de booking criada deve ser cancelada pelo fluxo canônico.

### Fase 2 — Failure paths

Cancelamento, refund, reagendamento, concorrência/idempotência, webhook
duplicado/atrasado, autorização por persona e reconnect/ausência do host Zoom.

### Fase 3 — Comunicação e operação

E-mails críticos reais, outbox/recovery, observabilidade sanitizada, Admin e
runbooks operacionais.

### Fase 4 — Launch UX

QA apenas das superfícies críticas em desktop/tablet/mobile, usando o quality
gate visual já documentado; sem redesign amplo.

### Fase 5 — Release Candidate

Regressão completa, revisão dos P0/P1, evidência HML/fornecedor e decisão
formal GO/NO-GO.

## Comandos executados

- `npm ls --depth=0 --omit=optional`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test` e teste focal de bloqueios
- `npm run test:deno`
- `npm run build`
- `npx supabase start`
- `npx supabase db lint`
- `npx supabase test db --local`
- `npx supabase projects list --output json`
- `npx supabase migration list --linked`
- `npx supabase functions list`
- `npm run payments:phase3:readiness:hml`
- `npm run zoom:video-sdk:env`
- `npx vitest run scripts/homologation/zoom-hml.test.mjs`
- Browser oficial: navegação read-only da home HML
- `deno test --config supabase/functions/deno.json --allow-env --allow-net ...auth/login.test.ts ...auth/runtime.test.ts`
- `npx vitest run src/features/therapist-blocks --reporter=verbose`
- `npx playwright test tests/e2e/hml-multi-context-auth.spec.ts --project=chromium`
- `npm run payments:phase3:runtime-preflight:hml`
- `npx supabase functions deploy client-auth-login therapist-auth-login admin-auth-login --use-api --project-ref <HML>`
- `npx supabase functions deploy stripe-hml-preflight --use-api --import-map supabase/functions/deno.json --project-ref <HML>`
- `gh run list --workflow quality.yml --limit 10 ...` e `gh run view <última-falha> --log-failed`

## Impacto documental

**Documentação atualizada.** A Fase 0.5 registra a regra fail-closed de
`MASTER_PASSWORD`, o harness de preflight Stripe HML e o smoke multi-context.
Não houve alteração de schema, rota de produto, RLS ou produção; quatro Edge
Functions foram publicadas exclusivamente em HML.

## Fase 1 — Golden Path transacional HML (tentativa 2026-08-21)

Decisão: **PHASE 1 FAIL**

Uma única tentativa usou a fixture oficial e um slot A selecionado no precheck
imediato. O runId foi mantido apenas em memória; o contrato público de
Checkout não possui campo próprio para persistir correlação de qualificação.
A correlação autoritativa usou a janela temporal da tentativa, serviço canônico
e read models de pagamento/booking.

| Checkpoint            | Resultado  | Evidência sanitizada                                                                                           |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Fixture precheck      | PASS       | Slot A elegível, sem booking, hold, payment ou video session; Connect pronto.                                  |
| Public discovery      | PASS       | Perfil QA, serviço de 50 min, preço R$ 120,00 e disponibilidade renderizados.                                  |
| Booking initiation    | PASS       | Uma operação canônica foi criada em `pending_payment`, BRL/R$ 120,00, sem duplicidade observada na janela.     |
| Stripe Checkout       | FAIL       | A Checkout Session Stripe test permaneceu `open` e `unpaid` após o submit no Embedded Checkout.                |
| Signed webhook        | FAIL       | Não houve `checkout.session.completed` processado; não há confirmação de assinatura a validar.                 |
| Authoritative payment | FAIL       | `session_payments.financial_status` permaneceu `pending`.                                                      |
| Booking confirmed     | FAIL       | Booking permaneceu `pending_payment`, conforme o estado financeiro canônico.                                   |
| Cross-persona         | NOT_TESTED | Não avançou após a falha de Checkout.                                                                          |
| Video session ready   | NOT_TESTED | Nenhuma `video_session` é criada antes de pagamento canônico; contagem observada: zero.                        |
| Zoom access window    | NOT_TESTED | Depende de booking pago. Não há avanço de relógio autorizado para HML.                                         |
| Therapist join        | NOT_TESTED | Depende de pagamento e janela Zoom autorizada.                                                                 |
| Patient join          | NOT_TESTED | Depende de host-first após entrada do terapeuta.                                                               |
| Session completion    | NOT_TESTED | Depende de sessão Zoom ativa.                                                                                  |
| Therapist financial   | NOT_TESTED | Não há recebimento pago para correlacionar.                                                                    |
| Admin consistency     | NOT_TESTED | Não há operação confirmada para validar ponta a ponta.                                                         |
| Database invariants   | NOT_TESTED | Foram observados um booking e um payment pendentes, mas os invariantes finais de operação paga não se aplicam. |

Root cause comprovada: a operação do Embedded Checkout não completou o
pagamento. A Stripe confirmou test mode e retornou a sessão como aberta e não
paga; por consequência o webhook não foi disparado e o banco preservou
corretamente os estados pendentes. Não há evidência de defeito de webhook,
Zoom, booking confirmado, financeiro ou Admin nesta tentativa.

Correção limitada ao harness: ele agora exige o redirect `/reserva/sucesso`
antes de reportar Checkout concluído. Nenhum dado de domínio foi alterado para
compensar a falha. Como o booking iniciou autoritativamente, os slots B/C não
foram usados. A reserva pendente histórica também não foi modificada; sua última
observação conhecida continua `pending_payment` e sua expiração pertence à Fase 2.

## Fase 1B — Embedded Checkout qualification HML

Data: 2026-08-21
Decisão: **PHASE 1B PASS**

O escopo desta etapa foi Checkout incorporado, Stripe, webhook e booking. Zoom,
financeiro do terapeuta, Admin e as validações completas da Fase 1 não foram
executados.

Root cause: o harness anterior preenchia somente número, validade e CVC. O
Checkout incorporado real também apresentou controles suplementares de
faturamento; o submit incompleto preservava a sessão como `open`/`unpaid`. A
correção é exclusivamente no harness de qualificação: ele coleta metadados de
campos/erros sem valores, completa nome/CEP quando presentes e exige o redirect
canônico antes de aceitar sucesso. Não houve alteração de UI, Checkout hosted,
regras de booking, RLS ou estados financeiros.

| Gate                        | Resultado | Evidência sanitizada                                                                                         |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Checkout return config      | PASS      | Stripe test `embedded_page`, `redirect_on_completion=always` e retorno HTTPS HML no path `/reserva/sucesso`. |
| Embedded Checkout render    | PASS      | Iframe Stripe anexado no browser visível.                                                                    |
| Payment interaction         | PASS      | Meio oficial Stripe test submetido após completar os controles exigidos.                                     |
| Redirect `/reserva/sucesso` | PASS      | O harness só consulta o backend após a rota de retorno canônica.                                             |
| Stripe Checkout final state | PASS      | Stripe test: `complete` e `paid`.                                                                            |
| Signed webhook              | PASS      | Um `checkout.session.completed` correlacionado foi processado.                                               |
| Authoritative payment       | PASS      | Pagamento canônico `paid`, BRL/R$ 120,00.                                                                    |
| Booking confirmation        | PASS      | Booking `confirmed`/`paid` e exatamente um pagamento para ele.                                               |

O pagamento confirmado criou uma única `video_session` como efeito canônico do
webhook, porém nenhum token foi lido e Zoom não foi aberto. As tentativas
pendentes anteriores permanecem inalteradas e serão avaliadas em abandono e
expiração na Fase 2.

Alterações: novo harness local
`scripts/homologation/embedded-checkout-hml.mjs` e extensão Admin-only,
restrita a HML, de `stripe-hml-preflight` para evidência sanitizada da sessão e
unicidade do pagamento. A função foi implantada somente em HML. Não houve
migration nem alteração em produção.

Validações: `npm run test:deno` (156/156), `deno check` do preflight, `node
--check` do harness, Prettier focal e inspeção HML somente leitura pós-pagamento.
Não há P0/P1 novo de produto; permanecem os P1 já registrados para Zoom real,
cross-persona, financeiro/Admin, CI remoto e e-mail operacional.

Documentação atualizada: este baseline e `release-qualification.md` registram a
evidência sem secrets, cookies, tokens ou identificadores Stripe.

## Fase 1C — Continuação do Golden Path HML

Data: 2026-08-21
Decisão: **PHASE 1 FAIL**

O booking canônico da Fase 1B foi preservado. Nenhum booking, Checkout,
pagamento, estado financeiro ou estado de agenda foi criado ou alterado nesta
continuação.

| Checkpoint                      | Resultado  | Evidência sanitizada                                                                                                                                 |
| ------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paid booking recheck            | PASS       | Booking `confirmed`/`paid`; pagamento `paid` BRL/R$ 120,00; um pagamento e uma video session; vínculos e serviço da fixture coerentes.               |
| Cross-persona consistency       | PASS       | Três BrowserContexts independentes renderizaram o mesmo encontro/sessão nas superfícies paciente, terapeuta e Admin.                                 |
| Video session ready             | PASS       | Exatamente uma video session vinculada ao booking, no estado inicial `ready`, sem token exposto.                                                     |
| Zoom access window              | BLOCKED    | O acesso anterior a T-15 foi negado corretamente; a validação dentro da janela não pode ocorrer agora sem violar a regra de não criar nova operação. |
| Therapist join                  | NOT_TESTED | Depende da janela autorizada.                                                                                                                        |
| Patient join                    | NOT_TESTED | Depende do host e da janela autorizada.                                                                                                              |
| Video session active/end        | NOT_TESTED | Não houve sessão Zoom aberta.                                                                                                                        |
| Session completion              | NOT_TESTED | Não houve sessão Zoom concluída.                                                                                                                     |
| Therapist financial consistency | NOT_TESTED | Mantido fora da sequência após o bloqueio Zoom.                                                                                                      |
| Admin operational consistency   | NOT_TESTED | O detalhe Admin pré-sessão passou no checkpoint cross-persona; a consistência pós-conclusão não foi exercitada.                                      |
| Database invariants finais      | NOT_TESTED | Os invariantes de pagamento/video pré-join passaram; os invariantes após encerramento não se aplicam sem sessão real.                                |

Root cause do bloqueio: a booking canônica inicia em 23/08/2026 às 10:15 BRT,
fora do intervalo operacional de T-15. O harness oficial HML falha fechado para
booking mais distante que 20 minutos e só prepara uma nova fixture para resolver
essa condição. Não foi identificado mecanismo HML de relógio controlado que
preserve uma booking já paga; o único override versionado pertence ao ciclo de
elegibilidade financeira, não à autorização Zoom. Criar outra booking é vedado
por esta fase, portanto não houve contorno.

Classificação: P1 de qualificação HML, não defeito comprovado do produto. As
tentativas históricas pendentes continuam sem cancelamento, alteração, remoção
ou reutilização; abandono e expiração permanecem na Fase 2. A próxima rodada
deve executar o harness oficial dentro de T-15 usando este mesmo booking, caso
ele ainda esteja elegível, ou receber autorização explícita para uma nova
fixture controlada.

Validações: Playwright visível com três contexts para o checkpoint
cross-persona e bloqueio pré-janela; `scripts/homologation/zoom-hml.test.mjs`
(15/15); `npm run test:deno` (156/156); `deno check` do preflight e Prettier
focal. Não houve alteração de produção, migration ou SQL manual.

## Fase 1D — Zoom + conclusão do Golden Path HML

Data: 2026-08-21
Decisão: **PHASE 1 BLOCKED — OUTSIDE ZOOM WINDOW**

O precheck somente leitura confirmou que a booking canônica continua
`confirmed`/`paid`, com pagamento `paid` em BRL/R$ 120,00, exatamente uma
payment e uma video session `ready`. O início continua em 23/08/2026 às 10:15
BRT, portanto o instante da consulta ainda era anterior a T-15. Nenhum CTA de
entrada, SDK, host, paciente, encerramento, conclusão, financeiro ou Admin
pós-sessão foi exercitado nesta rodada.

O booking foi preservado sem mutação. A continuação só poderá iniciar a partir
de 23/08/2026 às 10:00 BRT, com novo precheck autoritativo e o harness oficial,
sem criar booking, Checkout, pagamento, fixture ou video session.
