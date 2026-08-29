---
name: zoom-integration
description: Implementar e manter integracao Zoom Video SDK no TES com JWT backend, sessoes locais, webhooks, RLS e minimizacao LGPD.
---

# Integracao Zoom Video SDK

## Fontes

1. `AGENTS.md`.
2. `docs/zoom/*.md`.
3. `docs/product/integration-map.md`.
4. `src/lib/routes.ts`.
5. `supabase/migrations/*video_sdk*`.
6. `supabase/functions/_shared/zoom-video-sdk/`.

## Arquitetura

- Antes de alterar adapter/retries/mocks, consultar
  `docs/zoom/investigation-2026-08-27.md` e
  `docs/zoom/self-view-2026-08-27.md` e
  `docs/zoom/camera-routing-2026-08-28.md`. No SDK 2.4.5, `join` pode retornar
  um participante e `startVideo` retorna `undefined`; contratos específicos
  não dispensam rejeitar falhas resolvidas. A identidade devolvida pelo join
  deve ser preservada antes da mídia. `destroyClient` preserva o receiver.
  Falha de mídia/prévia não deve destruir uma conexão válida.
- Identidade tardia também precisa recuperar self-view já publicado. Não
  limitar reconciliação ao remoto nem repetir `startVideo`/join por falha de
  prévia. Preservar Promise de attach por geração e separar render cleanup
  de teardown. Em reentrada móvel abrupta, usar
  `video-capturing-change: Started` para reconciliar o ciclo atual depois que
  o pipeline local estiver pronto; ver
  `docs/zoom/patient-preview-recovery-2026-08-28.md` e
  `docs/zoom/abrupt-reentry-self-view-2026-08-28.md`.
- Browser: `@zoom/videosdk`.
- Paciente acessa a sala dedicada por `/app/encontros/:bookingId/video`.
- Terapeuta acessa a sala dedicada por
  `/terapeuta/sessoes/:bookingId/video`.
- O detalhe do booking apenas direciona para a sala; o Video SDK não deve ser
  montado dentro de cards ou páginas operacionais.
- `ZoomVideoCallPage` remove sidebar e topbar somente nessas rotas e reutiliza
  uma única instância de `ZoomVideoSessionAdapter`.
- Backend: `zoom-video-session-access` gera JWT curto do Video SDK.
- `role_type=0` para paciente e `role_type=1` para terapeuta responsavel.
- `video_sessions` e a fonte local da sessao por booking.
- `video_session_participations` registra eventos operacionais minimos.
- `zoom_video_webhook_events` guarda idempotencia e payload sanitizado.
- `video_session_control_jobs` guarda jobs duraveis de encerramento/reconcile.
- Fim técnico precoce aposenta a instância remota em metadata interna, sem
  encerrar o encontro. Presença considera somente a instância atual; eventos
  antigos não reabrem uma instância encerrada. Ausência e orphaning não são
  terminais antes de `scheduled_ends_at`; a grace de 120s é compatibilidade
  técnica, não prazo de expiração.
- A reserva de maintenance revalida os motivos e marca o pedido de fim sob
  lock da sessão antes de chamar o provider. Somente fim manual autorizado, fim
  agendado e hard timeout bloqueiam novos acessos. Jobs legados de ausência ou
  orphaning são no-op auditável; cron local fica inativo.
- Stripe confirma pagamento; Zoom nunca confirma pagamento, repasse ou servico.
- Nao ha criacao remota previa de sala. A sessao nasce no primeiro `join`.
- Paciente so recebe JWT apos webhook confiavel de `session.user_joined` do
  terapeuta; token emitido para terapeuta nao e presenca.
- `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` e obrigatorio no runtime real.
- Essa variável é somente o watchdog de custo para sessão órfã:
  `hard_ends_at = actual_started_at + duração configurada` (240 minutos em HML).
  O fim normal é `scheduled_ends_at`, enfileirado como `end_scheduled`; o
  watchdog usa `end_hard_timeout`. Nenhum deles altera o horário da reserva.
- A espera autenticada registra chegada pontual da versão atual entre T-15 e
  T+10 inclusive. Essa chegada ou `session.user_joined` confiável preserva a
  reconexão até, mas não incluindo, `scheduled_ends_at`; todo join continua
  exigindo presença atual do terapeuta.
- Encerramento definitivo é exclusivo do terapeuta entre T-5 inclusive e o fim
  agendado. O Edge valida horário do banco, ownership e sessão ativa, aciona o
  provedor e confirma `manual_end`; o browser nunca usa `leave(true)`.
- Enquanto a sala estiver `joined` ou `reconnecting`, o browser chama
  `POST /api/auth/session/refresh` periodicamente para manter a sessão TES
  autenticada. O endpoint só rotaciona tokens perto da expiração; uma falha de
  rede não encerra a mídia local e uma reconexão volta a tentar a renovação.

## Seguranca

Nunca expor SDK Secret, API Key, API Secret, webhook secret, JWT gerado,
payload bruto, audio, video, chat, transcricao ou dado clinico.

`session_name` e `user_key` devem ser opacos e limitados. O browser nunca
define papel, token, session name ou user key.

Os dois overloads de `apply_zoom_video_session_event_v1` sao exclusivos de
`service_role`. Toda migration que recriar esses RPCs deve revogar `EXECUTE` de
`PUBLIC`, `anon` e `authenticated`, conceder somente a `service_role` e manter
regressao pgTAP para as duas assinaturas.

## Testes

- Validar que os CTAs de detalhe apontam para a sala do mesmo booking.
- Validar que a sala dedicada não renderiza sidebar nem topbar.
- Validar encontro de 75 a 90 minutos para paciente e terapeuta, incluindo
  renovação do access token, atualização de página e queda/retorno de rede.
- Validar descarte abrupto do processo do paciente sem cleanup observável,
  reentrada com novo `userId`/mesmo `userKey`, captura tardia e recuperação da
  prévia sem nova publicação ou JWT. `pagehide` continua limpando a mídia.
- Validar desktop e mobile, foco visível, nomes acessíveis e retorno ao detalhe.
- `npm run zoom:video-sdk:env`
- `npm run zoom:video-sdk:test`
- `npm run zoom:video-sdk:webhook:smoke`
- `npm run zoom:video-sdk:webhook:tunnel`
- `npm run zoom:video-sdk:webhook:real-preflight`
- `npm run zoom:video-sdk:webhook:real-verify`
- `npm run zoom:video-sdk:api:mock`
- `npm run zoom:video-sdk:real-preflight`
- `npm run homologation:zoom:local`
- `node scripts/homologation/zoom-hml.mjs --confirm-single-hml-session --confirm-hml-vercel-share --prepare-canonical-hml-fixture --resolve-canonical-hml-fixture --use-admin-magic-link-sessions --duration-seconds=45`
- `npm run zoom:video-sdk:test:real -- --confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=250 --allow-direct-paid-fixture-for-zoom-only` somente para diagnostico tecnico isolado
- `npm run zoom:video-sdk:emergency-end`

Com `ALLOW_REAL_ZOOM=false`, nao fazer chamada externa nem entrar em sessao real.

## Operacao

- Configurar manualmente os eventos `session.started`, `session.ended`,
  `session.user_joined` e `session.user_left`.
- Usar `docs/zoom/real-homologation-runbook.md` antes de qualquer sessao real.
- Nao exigir booking, e-mail ou senha em variavel de ambiente para homologacao
  real; o harness cria fixtures temporarias e limpa no `finally`.
- `zoom:video-sdk:webhook:tunnel` e `zoom:video-sdk:webhook:real-verify` usam
  `.tmp/zoom-real-homologation.json` para metadados temporarios sem secrets.
- A emissao de JWT deve passar pelo rate limit distribuido
  `reserve_zoom_video_access_issue_v1`; nao usar bucket apenas em memoria.
- O teste real exige confirmacao manual momentanea do Marketplace Zoom por flags
  e usa contexts Playwright separados para terapeuta e paciente; a execucao real
  deve ser visivel (`--headed`) e com `--slow-mo`.
- O harness HML separado em `scripts/homologation/zoom-hml.mjs` exige URL remota
  com `_vercel_share` e `SUPABASE_URL` do projeto HML
  `emzwqkmrryuqvqiohqnu`. Ele primeiro resolve uma booking elegível dos perfis
  declarados; com `--prepare-canonical-hml-fixture`, cria uma nova reserva pelo
  Checkout Stripe test real e só aceita a fixture depois do webhook processado,
  `session_payments.financial_status = paid` e `video_sessions` existente.
  Ajustes temporários de disponibilidade são restaurados no `finally`.
- `--use-admin-magic-link-sessions` cria sessões de Auth de uso único em memória
  para os três contexts sem trocar senha nem persistir tokens. Continua exigindo
  `service_role` apenas no processo local de homologação e nunca no browser.
- O harness usa contexts Playwright isolados para cliente, terapeuta e Admin,
  booking entre 15 e 20 minutos antes do início, duração entre 30 e 60 segundos
  e evidências sanitizadas sob `.tmp/homologation/`. O gate real também exige
  recuperação de permissão, câmera bidirecional e viewports desktop/tablet/
  mobile durante a chamada.
- A prova bidirecional liga primeiro a câmera do terapeuta, confirma o remoto
  no paciente, liga a câmera do paciente e confirma que ambos mantêm self-view
  e remoto. Safari/iPhone e Chrome/Android reais permanecem gates separados.
- O aceite 1:1 exige uma única identidade remota selecionada por roster
  autoritativo, no máximo um player por container, exclusão de segundo
  dispositivo com o mesmo `userKey` local, detach pelo elemento exato e
  invalidação de timers/attaches de gerações anteriores.
- O harness HML falha fechado sem fixture canônica resolvida, sem `_vercel_share`,
  com `provider_session_id` preexistente, com qualquer sessao Zoom ativa antes
  do teste, ou se o pagamento canonico estiver ausente. Ele nao cria fixture
  paga direta, nao usa `supabase status` local como evidencia remota e nao faz
  deploy.
- Homologacao transacional principal deve passar por Checkout Stripe test,
  webhook assinado e `session_payments.financial_status = paid`; fixture com
  pagamento direto nao conclui homologacao Stripe + Zoom.
- Manter o cron de `zoom-video-session-maintenance` configurado via Vault/pg_net
  conforme `supabase/schedules/zoom-video-session-maintenance.sql`.
- Manter gravacao automatica, transcricao, controle remoto e recursos nao usados
  desativados nesta fase.
- Antes de remover configuracoes antigas no Zoom, confirmar que nenhuma funcao,
  webhook ou secret antigo continua implantado.

## Pendencias Conhecidas

- Homologar webhook publico no ambiente alvo.
- Reexecutar o Security Advisor do ambiente alvo apos qualquer alteracao nos
  RPCs de eventos Zoom e confirmar que nao ha permissao publica residual.
- Fechar politica de retencao legal de eventos operacionais.
- Rodar teste real controlado somente com `ALLOW_REAL_ZOOM=true`.
