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

- Browser: `@zoom/videosdk`.
- Backend: `zoom-video-session-access` gera JWT curto do Video SDK.
- `role_type=0` para paciente e `role_type=1` para terapeuta responsavel.
- `video_sessions` e a fonte local da sessao por booking.
- `video_session_participations` registra eventos operacionais minimos.
- `zoom_video_webhook_events` guarda idempotencia e payload sanitizado.
- Stripe confirma pagamento; Zoom nunca confirma pagamento, repasse ou servico.
- Nao ha criacao remota previa de sala. A sessao nasce no primeiro `join`.

## Seguranca

Nunca expor SDK Secret, API Key, API Secret, webhook secret, JWT gerado,
payload bruto, audio, video, chat, transcricao ou dado clinico.

`session_name` e `user_key` devem ser opacos e limitados. O browser nunca
define papel, token, session name ou user key.

## Testes

- `npm run zoom:video-sdk:env`
- `npm run zoom:video-sdk:test`
- `npm run zoom:video-sdk:webhook:smoke`
- `npm run zoom:video-sdk:webhook:tunnel`
- `npm run zoom:video-sdk:webhook:real-preflight`
- `npm run zoom:video-sdk:webhook:real-verify`
- `npm run zoom:video-sdk:api:mock`
- `npm run zoom:video-sdk:real-preflight`
- `npm run zoom:video-sdk:test:real`

Com `ALLOW_REAL_ZOOM=false`, nao fazer chamada externa nem entrar em sessao real.

## Operacao

- Configurar manualmente os eventos `session.started`, `session.ended`,
  `session.user_joined` e `session.user_left`.
- Usar `docs/zoom/real-homologation-runbook.md` antes de qualquer sessao real.
- Nao exigir booking, e-mail ou senha em variavel de ambiente para homologacao
  real; o harness cria fixtures temporarias e limpa no `finally`.
- `zoom:video-sdk:webhook:tunnel` e `zoom:video-sdk:webhook:real-verify` usam
  `.tmp/zoom-real-homologation.json` para metadados temporarios sem secrets.
- Manter gravacao automatica, transcricao, controle remoto e recursos nao usados
  desativados nesta fase.
- Antes de remover configuracoes antigas no Zoom, confirmar que nenhuma funcao,
  webhook ou secret antigo continua implantado.

## Pendencias Conhecidas

- Homologar webhook publico no ambiente alvo.
- Fechar politica de retencao legal de eventos operacionais.
- Rodar teste real controlado somente com `ALLOW_REAL_ZOOM=true`.
