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
- `NGROK_AUTHTOKEN` para tunel temporario de webhook real
- `ZOOM_PUBLIC_WEBHOOK_URL` opcional apenas no terminal local, quando a URL
  publica temporaria ja foi configurada manualmente e nao veio do script ngrok

Comandos locais:

```bash
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:webhook:tunnel
```

O tunel grava somente metadados nao secretos em
`.tmp/zoom-real-homologation.json`. A verificacao real do webhook atualiza esse
arquivo com uma confirmacao temporaria; o teste real cria e limpa fixtures em
runtime.

`ALLOW_REAL_ZOOM` aceita estritamente `true` ou `false`. Ausente, vazio ou
invalido falha fechado como `false`.
