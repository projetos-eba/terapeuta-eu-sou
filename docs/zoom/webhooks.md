# Webhooks Zoom

Endpoint genérico:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/zoom-webhook
```

Eventos operacionais recomendados:

- `meeting.started`
- `meeting.ended`
- `meeting.participant_joined`
- `meeting.participant_left`
- `meeting.participant_waiting`
- `meeting.participant_admitted`

As variantes `*.v2` equivalentes também são aceitas quando o Zoom as enviar.

Validação:

- `x-zm-signature` com HMAC SHA-256;
- `x-zm-request-timestamp` com janela anti-replay;
- challenge-response `endpoint.url_validation` com `plainToken` e `encryptedToken`.

Falhas esperadas:

- corpo maior que o limite local: `413`;
- JSON inválido: `400`;
- assinatura/timestamp ausente, inválido, futuro ou expirado: `400`;
- evento não suportado: evento persistido como `ignored` e resposta `200`.

Persistência:

- hash SHA-256 do corpo bruto;
- campos normalizados;
- payload sanitizado mínimo;
- sem corpo bruto indefinido, conteúdo clínico, áudio, vídeo, chat ou transcrição.

Para desenvolvimento com ngrok, use:

```bash
npm run zoom:webhook:real-preflight
npm run zoom:webhook:tunnel
```

Copie a URL pública exibida pelo script para o Zoom Marketplace manualmente. O repositório não altera configuração remota do Zoom.
