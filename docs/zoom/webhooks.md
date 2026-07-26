# Webhooks Zoom Video SDK

Endpoint:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/zoom-webhook
```

Eventos habilitados nesta fase:

- `session.started`
- `session.ended`
- `session.user_joined`
- `session.user_left`

Tambem e necessario responder `endpoint.url_validation`.

Requisitos:

- validar corpo bruto antes de persistir;
- limitar tamanho do corpo;
- validar `x-zm-signature` e `x-zm-request-timestamp`;
- responder challenge com `plainToken` e `encryptedToken`;
- rejeitar replay;
- gravar hash SHA-256 do payload e campos sanitizados minimos;
- processar duplicata como sucesso;
- tratar evento desconhecido como `ignored`;
- nunca alterar pagamento, repasse ou elegibilidade financeira.

Smoke local:

```bash
npm run zoom:video-sdk:webhook:smoke
```
