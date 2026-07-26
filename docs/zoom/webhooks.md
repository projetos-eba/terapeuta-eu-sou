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

Tunel real local:

```bash
npm run zoom:video-sdk:webhook:tunnel
```

Configurar manualmente no Zoom:

```text
https://<subdominio-ngrok>/functions/v1/zoom-webhook
```

O script nao altera o Zoom Marketplace e deve ficar ativo ate o fim da
homologacao. Ele grava a URL atual em `.tmp/zoom-real-homologation.json`, sem
secrets. URLs ngrok mudam; uma nova URL exige nova validacao manual.

Depois de validar manualmente no Zoom, registre a confirmacao temporaria:

```bash
npm run zoom:video-sdk:webhook:real-verify
```

A confirmacao expira em janela curta e fica vinculada a URL atual.
