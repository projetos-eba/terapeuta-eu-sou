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
```

`zoom:video-sdk:test:real` recusa execucao quando qualquer gate real estiver
incompleto: webhook nao validado ou expirado em
`.tmp/zoom-real-homologation.json`, URL ngrok divergente, sessao ativa
preexistente, Supabase nao local/staging autorizado ou ambiente diferente de
`development`. O script cria booking, usuarios, pagamento paid e `video_session`
em runtime; nao exige UUID, e-mail ou senha via ambiente.

Runbook completo: `docs/zoom/real-homologation-runbook.md`.
