# Troubleshooting Zoom

## OAuth falha

Verifique `ZOOM_ACCOUNT_ID`, `ZOOM_S2S_CLIENT_ID`, `ZOOM_S2S_CLIENT_SECRET` e se o app S2S está ativado.

## Sala não provisiona

Confirme:

- `session_payments.financial_status = paid`;
- job em `zoom_meeting_jobs`;
- execução de `zoom-jobs-process`;
- scopes de criação/atualização de meeting.
- passcode com no máximo 10 caracteres quando a conta Zoom impõe esse limite.

Se o Supabase local responder `404` para `zoom-jobs-process`, execute explicitamente:

```bash
npx supabase functions serve zoom-jobs-process --env-file supabase/functions/.env --no-verify-jwt
```

Em seguida rode novamente o fluxo:

```bash
npm run zoom:edge:real
```

## Terapeuta não inicia como host

Possíveis causas:

- scope de ZAK ausente;
- General App ainda não autorizado/instalado para o host;
- usuário host não pertence à conta;
- licença/configuração Zoom insuficiente.

Quando o teste real retornar erro sanitizado em `get-zak`, a criação, update e exclusão de reunião ainda podem estar corretas. Trate ZAK como pendência separada de Marketplace/autorização.

## Webhook falha

Confirme secret token, timestamp, assinatura HMAC, URL remota e eventos assinados.

Use `npm run zoom:webhook:smoke` para validar assinatura e efeitos locais antes de configurar a URL pública no Marketplace. Use `npm run zoom:webhook:real-preflight` e `npm run zoom:webhook:tunnel` para preparar ngrok sem alterar a configuração remota.
