# TES — Release Readiness Baseline (Fase 0)

Data: 2026-08-21  
Commit inspecionado: `ffad0b2b` (worktree também contém alterações de outras frentes, preservadas)  
Ambientes: local, Supabase HML, Stripe test-mode parcial, Zoom local configurado e HML público  
Decisão: **PHASE 1 NOT READY**

## Como ler este baseline

Este documento registra evidência desta rodada, não aprovação de produção.
`PASS` significa que o gate indicado foi comprovado no ambiente indicado;
`FAIL` significa que foi reproduzido um problema; `BLOCKED` que falta acesso,
configuração ou pré-condição externa; `NOT_TESTED` que não foi exercitado.

Implementado não equivale a testado. Teste local não equivale a HML. HML não
equivale a fornecedor externo real em test mode.

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

| ID    | Área             | Persona                  | Gate                                                | Ambiente            | Status     | Evidência                                                                                                                                                                                                                         | Severidade | Próxima ação                                                                                             |
| ----- | ---------------- | ------------------------ | --------------------------------------------------- | ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| F0-01 | Dependências     | Engenharia               | Árvore Node instalada                               | local               | PASS       | `npm ls --depth=0 --omit=optional` saiu 0; há 5 pacotes extraneous de `sharp`/WASM.                                                                                                                                               | P2         | Reproduzir em CI com `npm ci`; não limpar `node_modules` nesta fase.                                     |
| F0-02 | TypeScript       | Engenharia               | Typecheck                                           | local               | PASS       | `npm run typecheck` saiu 0.                                                                                                                                                                                                       | P2         | Manter no CI.                                                                                            |
| F0-03 | Lint             | Engenharia               | ESLint + políticas TES                              | local               | PASS       | `npm run lint`: políticas visual e online-only sem violações; ESLint sem erros.                                                                                                                                                   | P2         | Planejar migração de `next lint`, que está depreciado.                                                   |
| F0-04 | Formatação       | Engenharia               | Prettier global                                     | local               | FAIL       | `npm run format:check` listou extensa dívida preexistente e não concluiu dentro do limite de execução desta auditoria; não foi feita formatação global.                                                                           | P2         | Corrigir em mudança isolada; não bloquear Fase 1 por este item.                                          |
| F0-05 | Unitário         | Engenharia               | Vitest completo                                     | local               | FAIL       | `npm run test` revelou falha reproduzível em `therapist-blocks-panel.test.tsx`: 3/4 testes passam. O fixture usa `2026-08-20`, anterior ao dia local desta rodada (`2026-08-21`), deixa o formulário inválido e impede o `fetch`. | P1         | Fixar o relógio ou usar data futura no teste; reexecutar a suíte completa antes de RC.                   |
| F0-06 | Edge Functions   | Engenharia               | Deno                                                | local               | PASS       | `npm run test:deno`: **153 passed, 0 failed**. Inclui auth, e-mail, pagamentos, booking, cancelamento e Zoom.                                                                                                                     | P2         | Manter no CI.                                                                                            |
| F0-07 | Banco/RLS        | Todas                    | pgTAP                                               | local               | PASS       | `npx supabase test db --local`: **68 arquivos, 1.484 testes, PASS**.                                                                                                                                                              | P1         | Reexecutar a suíte contra HML após credencial read-only apropriada.                                      |
| F0-08 | Banco            | Engenharia               | `supabase db lint`                                  | local               | PASS       | Saiu 0 com **12 avisos**: 8 de volatilidade declarada e 4 de variáveis não usadas.                                                                                                                                                | P2         | Corrigir em hardening SQL qualificado.                                                                   |
| F0-09 | Build            | Todas                    | Build de produção                                   | local               | PASS       | `npm run build`: **110 rotas** geradas, compilação/tipos concluídos.                                                                                                                                                              | P1         | Executar o mesmo artefato no deploy HML.                                                                 |
| F0-10 | CI               | Engenharia               | Workflow GitHub                                     | repositório         | NOT_TESTED | `.github/workflows/quality.yml` executa install, formato de arquivos alterados, tipos, lint, Vitest, Deno e build; não há evidência de run remoto nesta rodada.                                                                   | P1         | Observar uma execução verde de PR/push.                                                                  |
| F0-11 | Supabase HML     | Todas                    | Projeto e migrations até `20260820194000`           | HML                 | PASS       | Projeto HML ativo/vinculado; `supabase migration list --linked` coincide até `20260820194000`.                                                                                                                                    | P1         | Aplicar a migration pendente de notificações apenas pela janela de deploy autorizada.                    |
| F0-12 | Supabase HML     | Todas                    | Drift de migration                                  | HML                 | FAIL       | `20260821142516_shell_notifications.sql` existe localmente e está ausente em HML.                                                                                                                                                 | P1         | Definir owner/deploy da migration e repetir o inventário.                                                |
| F0-13 | Edge Functions   | Todas                    | Functions críticas implantadas                      | HML                 | PASS       | `supabase functions list` mostra ativas `session-booking-checkout`, Stripe Billing/Connect, Zoom, outbox e funções de payout.                                                                                                     | P1         | Validar versões contra a revisão liberada antes do Golden Path.                                          |
| F0-14 | RLS/ACL          | Paciente/Terapeuta/Admin | Isolamento e RPCs                                   | local               | PASS       | pgTAP cobre paciente A×B, terapeuta A×B, acesso Admin, RPC financeira e `reserve_booking_hold_v1`; migration de hardening está aplicada em HML.                                                                                   | P0         | Executar ataque controlado equivalente em HML na Fase 2.                                                 |
| F0-15 | Views/RPC        | Público/privado          | Views, `SECURITY DEFINER`, grants                   | local               | PASS       | `044_security_authorization_surface.sql` passou; allowlist pública, views sem DML a `anon`/`authenticated`, hold só para `service_role`.                                                                                          | P0         | Revalidar após qualquer migration que recrie view/função.                                                |
| F0-16 | Segurança        | Paciente/Terapeuta       | `MASTER_PASSWORD`                                   | código/HML          | FAIL       | `client-auth-login` e `therapist-auth-login` não passam `masterPasswordBypassEnabled`; `loginWithPasswordOrMaster` assume `true`. Um `MASTER_PASSWORD` remoto habilita fallback de login.                                         | **P0**     | Decisão explícita para remover/limitar o bypass a local e teste Deno de negação em URL não local.        |
| F0-17 | Segurança        | Admin                    | `ADMIN_MASTER_PASSWORD_BYPASS_ENABLED`              | código              | PASS       | Admin só habilita bypass se flag booleana válida **e** host Supabase é `localhost`/`127.0.0.1`.                                                                                                                                   | P1         | Cobrir endpoint completo em HML com flag ausente.                                                        |
| F0-18 | Segurança        | Todas                    | Secrets no front-end                                | código rastreado    | PASS       | Varredura não encontrou secret Supabase/Stripe/Zoom/e-mail no `src/`; `.env` local não é rastreado e exemplos usam placeholders.                                                                                                  | P0         | Repetir em CI com scanner de secrets.                                                                    |
| F0-19 | Segurança        | Auth                     | Leaked Password Protection                          | HML                 | NOT_TESTED | `docs/security/authorization-surface-hardening.md` registra "preparado/documentado, não ativado".                                                                                                                                 | P2         | Ativar primeiro em HML e testar signup/login/reset.                                                      |
| F0-20 | Segurança        | Banco                    | `search_path` legado                                | local               | FAIL       | A documentação identifica funções `SECURITY DEFINER` legadas com `search_path=public`; não houve recriação qualificada.                                                                                                           | P2         | Hardening por função, com objetos qualificados e pgTAP.                                                  |
| F0-21 | Stripe           | Terapeuta/Paciente/Admin | Readiness HML sem mutação                           | HML/test            | BLOCKED    | `npm run payments:phase3:readiness:hml`: Stripe está em test mode, porém `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` seguros não estão disponíveis ao harness. Catálogo, fixtures e webhooks não foram lidos.                    | **P0**     | Fornecer variáveis efêmeras do HML ao processo de qualificação, sem registrá-las, e repetir o preflight. |
| F0-22 | Stripe           | Paciente                 | Checkout → webhook → pagamento                      | HML/test            | NOT_TESTED | Scripts existem, mas não foi criada cobrança nesta fase.                                                                                                                                                                          | P1         | Fase 1: cenário aprovado com webhook assinado e evidência de `session_payments=paid`.                    |
| F0-23 | Stripe           | Terapeuta                | Billing/Checkout e assinatura                       | HML/test            | NOT_TESTED | Functions de Billing ativas; sem Checkout real/test webhook nesta rodada.                                                                                                                                                         | P1         | Fase 1: Premium/Premium Plus e reconciliação autoritativa.                                               |
| F0-24 | Stripe Connect   | Terapeuta/Admin          | Onboarding, sync e repasse                          | HML/test            | NOT_TESTED | Functions Connect/payout ativas; estado da conta e capabilities não foram consultados.                                                                                                                                            | P1         | Validar hosted onboarding e sync server-side antes do launch.                                            |
| F0-25 | Zoom             | Paciente/Terapeuta       | Configuração/harness                                | local               | PASS       | `npm run zoom:video-sdk:env` confirmou chaves/limite configurados e `ALLOW_REAL_ZOOM=true`; contrato HML: **15/15** testes.                                                                                                       | P1         | Não interpretar como sessão real.                                                                        |
| F0-26 | Zoom             | Paciente/Terapeuta       | Video SDK, webhook e host-first                     | HML/fornecedor real | BLOCKED    | Sem booking pago por webhook Stripe, URL/share HML controlada e personas, o harness não pode abrir a única sessão curta autorizada.                                                                                               | P1         | Fase 1: executar o runbook HML com contexts separados e evidência de join/leave/webhooks.                |
| F0-27 | E-mail           | Paciente/Terapeuta/Admin | Outbox, retry e recovery                            | local               | PASS       | pgTAP de outbox passou; Deno cobre Hostinger, templates, limites e falha fechada. A migration agenda recovery por `pg_cron`.                                                                                                      | P1         | Confirmar schedule, Vault, sender e dispatch em HML.                                                     |
| F0-28 | E-mail           | Paciente/Terapeuta/Admin | Hostinger/sender/secrets reais                      | HML/fornecedor real | BLOCKED    | Function `email-outbox-dispatch` está ativa, mas a listagem de nomes de secrets não retornou dados úteis e não houve envio HML.                                                                                                   | P1         | Validar registry/sender e um envio controlado na Fase 3.                                                 |
| F0-29 | Browser          | Público                  | HML pública                                         | HML                 | PASS       | Navegador oficial abriu `https://hml.terapeutaeusou.com.br/` e DOM/navegação pública renderizaram.                                                                                                                                | P1         | Capturar smoke público por viewport na Fase 4.                                                           |
| F0-30 | Browser/E2E      | Paciente/Terapeuta/Admin | Contexts autenticados independentes                 | HML                 | BLOCKED    | Não foram fornecidas personas de teste/sessões compartilhadas; não houve login nem transmissão de credenciais.                                                                                                                    | **P0**     | Preparar três personas controladas e acesso efêmero para Playwright/browser visível.                     |
| F0-31 | Público          | Público                  | Discovery → Match → terapias → perfil               | HML                 | NOT_TESTED | Página pública HML e links de discovery renderizam; Match/catálogo/perfil não foram percorridos ponta a ponta.                                                                                                                    | P1         | Fase 1: smoke público antes da reserva.                                                                  |
| F0-32 | Paciente         | Paciente                 | Pagamentos e comprovante                            | App Router          | FAIL       | `routes.ts` e inventários declaram `/app/pagamentos*`; não há páginas correspondentes. `booking-detail.queries.ts` ainda fabrica `/app/pagamentos/comprovantes/:bookingId`, também inexistente.                                   | P1         | Definir rota/UX canônica ou remover o destino com teste de rota.                                         |
| F0-33 | Paciente         | Paciente                 | Configurações                                       | App Router          | FAIL       | `/app/configuracoes` e quatro subrotas constam em docs/rotas, mas não existem em `src/app`.                                                                                                                                       | P2         | Classificar no roadmap; não é condição do Golden Path inicial.                                           |
| F0-34 | Paciente         | Paciente                 | Aliases de encontros                                | App Router          | PASS       | `/app/sessoes*` existe como redirects em `next.config.mjs` para `/app/encontros*`.                                                                                                                                                | P2         | Manter teste de contrato de redirects.                                                                   |
| F0-35 | Pessoa terapeuta | Terapeuta                | Cadastro, plano, agenda, serviços, Zoom, financeiro | HML                 | NOT_TESTED | Rotas e functions existem; banco/Edge local passam; não houve persona HML autenticada.                                                                                                                                            | P1         | Cobrir no Golden Path e failure paths.                                                                   |
| F0-36 | Administração    | Admin                    | Login e módulos operacionais                        | HML                 | NOT_TESTED | Rotas e read models existem, pgTAP de administração passa; sem sessão Admin HML.                                                                                                                                                  | P1         | Preparar persona Admin e smoke read-only na Fase 3.                                                      |

## P0 existentes

1. **F0-16 — bypass de `MASTER_PASSWORD` de paciente/terapeuta.** Risco de
   acesso indevido se o secret existir em produção/HML. A correção altera
   autenticação e requer decisão explícita conforme `AGENTS.md`.
2. **F0-21 — preflight Stripe HML bloqueado.** Sem URL/credencial de serviço
   efêmera o harness não prova catálogo, webhooks, fixture nem limite HML.
3. **F0-30 — personas/browser de HML.** Sem contexts autenticados controlados
   não é possível qualificar as três áreas privadas de forma segura.

## P1 existentes

- F0-05: uma falha unitária em bloqueios de agenda.
- F0-10: workflow CI existe, sem evidência de execução remota.
- F0-12: migration HML pendente.
- F0-22: Golden Path financeiro ainda não executado; é o alvo principal da Fase 1.
- F0-23/F0-24: assinatura e Connect sem prova externa HML.
- F0-26: Zoom real HML depende das pré-condições de Stripe e personas.
- F0-27/F0-28: operação de e-mail real HML sem prova.
- F0-32: pagamentos/comprovante do paciente apontam para rotas inexistentes.
- F0-35/F0-36: superfícies autenticadas de terapeuta/Admin sem smoke HML.

## Itens bloqueados por infraestrutura/configuração externa

- Variáveis efêmeras do processo de qualificação Stripe HML (`SUPABASE_URL`,
  credencial de serviço, publishable key, webhook secret e persona de teste).
- Personas HML separadas de paciente, terapeuta e Admin, e eventual acesso
  Vercel/share necessário ao ambiente.
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

1. Decisão e correção/mitigação comprovada do P0 de `MASTER_PASSWORD`.
2. Process environment efêmero para HML Stripe test, sem persistência em
   arquivo, contendo URL HML e credenciais mínimas do harness.
3. Fixture pública de terapeuta com serviço/slot e uma persona paciente
   confirmada; persona terapeuta aprovada e, para o percurso administrativo,
   uma persona Admin isolada.
4. Browser/Playwright visível com três BrowserContexts independentes.
5. Webhooks Stripe test apontando para HML e capacidade de observar a entrega
   assinada e o replay idempotente.
6. Zoom Marketplace/webhook configurado e validado para HML, com autorização
   manual para uma única sessão de 30–60 segundos após pagamento canônico.
7. Owner e janela para sincronizar a migration HML pendente ou decisão formal
   de excluí-la do release candidate atual.

## Próximas fases propostas

### Fase 1 — Golden Path real

Discovery → reserva → Stripe test Checkout → webhook assinado → booking pago
→ Zoom host-first → conclusão → read models financeiro/Admin. Evidência deve
trazer IDs mascarados, estados autoritativos e replay idempotente.

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

## Impacto documental

**Documentação atualizada.** Este board é a fotografia versionada da Fase 0.
Não altera regras de negócio, rotas, schema, permissões nem produção.
