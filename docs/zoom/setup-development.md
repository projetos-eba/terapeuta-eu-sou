# Setup de Desenvolvimento Zoom

Secrets pertencem somente a `supabase/functions/.env.local`, `supabase/functions/.env` ou secrets remotos das Edge Functions.

Variáveis:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_S2S_CLIENT_ID`
- `ZOOM_S2S_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`
- `ZOOM_DEFAULT_HOST_USER_ID`
- `ZOOM_WEBHOOK_SECRET_TOKEN`
- `ZOOM_ENVIRONMENT=development|production`

Comandos:

```bash
npm run zoom:env
npm run zoom:test:connection
npm run zoom:test:real
npm run zoom:test:webhook
npm run zoom:jobs:process
```

Testes reais exigem `ALLOW_REAL_ZOOM_TESTS=true`. O relatório não imprime tokens, ZAK, secrets, passcode, `join_url` ou `start_url`.
