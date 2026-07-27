# Testes Zoom Video SDK

Nesta rodada `ALLOW_REAL_ZOOM=false`.

Permitido:

- unitarios de ambiente, JWT, assinatura, challenge e sanitizacao;
- Vitest com mock de `@zoom/videosdk`;
- smoke local de webhook assinado;
- API mockada;
- Supabase local com `db reset`, `db lint` e pgTAP.

Nao permitido com `ALLOW_REAL_ZOOM=false`:

- iniciar sessao real;
- entrar em sessao real;
- chamar REST API real do Zoom;
- abrir tunel publico;
- consumir creditos.

Comandos:

```bash
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npm run zoom:video-sdk:webhook:smoke
npm run zoom:video-sdk:webhook:real-preflight
npm run zoom:video-sdk:webhook:tunnel
npm run zoom:video-sdk:webhook:real-verify -- https://<subdominio-ngrok>/functions/v1/zoom-webhook
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:real-preflight
npm run zoom:video-sdk:test:real
npm run zoom:video-sdk:emergency-end
```

`zoom:video-sdk:test:real` recusa execucao quando qualquer gate real estiver
incompleto: webhook nao validado ou expirado em
`.tmp/zoom-real-homologation.json`, URL ngrok divergente, sessao ativa
preexistente, Supabase nao local/staging autorizado ou ambiente diferente de
`development`, ou `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` ausente/invalido.
Ele tambem exige as flags momentaneas
`--confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=<ms>`,
depois da validacao manual no Zoom Build Platform. O script cria booking,
usuarios, pagamento paid e `video_session` em runtime; nao exige UUID, e-mail ou
senha via ambiente.

O fluxo real e host-first: paciente abre a tela primeiro e fica em sala de
espera sem receber JWT; terapeuta entra; webhook `session.user_joined` confirma
presenca; paciente e liberado por `preview` e so entao consome um token.

A emissao de JWT do Video SDK e protegida por rate limit distribuido no
Postgres, via `reserve_zoom_video_access_issue_v1`, para evitar bypass por
multiplas instancias de Edge Function.

O encerramento automatico usa `video_session_control_jobs` e a Edge Function
`zoom-video-session-maintenance`, acionada por cron interno conforme template em
`supabase/schedules/zoom-video-session-maintenance.sql`.

Se o harness falhar antes de capturar `provider_session_id`, ele tenta descobrir
uma sessao ativa unica no cleanup. A rotina operacional
`zoom:video-sdk:emergency-end -- --active-singleton` existe somente para esse
caso e recusa ambiguidades.

Runbook completo: `docs/zoom/real-homologation-runbook.md`.
