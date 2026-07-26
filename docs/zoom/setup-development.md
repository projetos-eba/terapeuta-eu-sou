# Setup de Desenvolvimento Zoom Video SDK

Secrets ficam somente em `supabase/functions/.env` ou secrets remotos das Edge
Functions.

Variaveis:

- `ZOOM_VIDEO_SDK_KEY`
- `ZOOM_VIDEO_SDK_SECRET`
- `ZOOM_VIDEO_SDK_API_KEY`
- `ZOOM_VIDEO_SDK_API_SECRET`
- `ZOOM_WEBHOOK_SECRET_TOKEN`
- `ZOOM_ENVIRONMENT=development|production`
- `ALLOW_REAL_ZOOM=true|false`

Comandos locais:

```bash
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npm run zoom:video-sdk:api:mock
```

`ALLOW_REAL_ZOOM` aceita estritamente `true` ou `false`. Ausente, vazio ou
invalido falha fechado como `false`.
