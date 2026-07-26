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
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:real-preflight
npm run zoom:video-sdk:test:real
```

`zoom:video-sdk:test:real` recusa execucao quando `ALLOW_REAL_ZOOM` nao e
`true` e, mesmo liberado, ainda exige homologacao manual antes de qualquer
ingresso real futuro.
