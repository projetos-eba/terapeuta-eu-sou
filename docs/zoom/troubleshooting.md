# Troubleshooting Zoom Video SDK

## O teste real foi bloqueado antes de abrir a sessao

Isso e esperado quando qualquer gate estiver incompleto. Corrija apenas o item
listado e rode de novo. O comando nao cria fixtures nem abre browser sem:

- `ALLOW_REAL_ZOOM=true`;
- `ZOOM_ENVIRONMENT=development`;
- Supabase local ou staging autorizado;
- URL ngrok ativa;
- webhook verificado e nao expirado para a URL atual;
- pagamento Stripe test confirmado por webhook canonico quando o objetivo for
  homologacao transacional completa;
- nenhuma sessao ativa;
- flags `--confirm-zoom-marketplace --confirm-single-real-session`.

## O webhook expirou

Rode novamente:

```bash
npm run zoom:video-sdk:webhook:real-verify
```

A confirmacao dura pouco e fica vinculada a URL ngrok atual. Nova URL exige nova
validacao manual no Zoom e novo `real-verify`.

## O Marketplace mostra `URL validation failed. Try again later`

Esse erro pode ocorrer mesmo com HTTP 200 quando o corpo do
`endpoint.url_validation` nao esta no formato exato esperado pelo Zoom. A
resposta deve ser o JSON raiz:

```json
{
  "plainToken": "<plainToken recebido>",
  "encryptedToken": "<hmac sha256 do plainToken com o Secret Token>"
}
```

Nao use o envelope padrao da API TES, como `{ "ok": true, "data": ... }`, para
esse evento. Antes de clicar em **Validate** no Marketplace, rode:

```bash
npm run zoom:video-sdk:webhook:real-preflight
```

O resultado precisa indicar `validationShape: true`.

Se o terapeuta consegue entrar no Video SDK, mas a fase
`therapist_presence_webhook` termina em `poll_timeout`, a URL publica pode estar
respondendo ao preflight sem estar ativa na assinatura do Zoom. Mantenha
`npm run zoom:video-sdk:webhook:tunnel` em execução, confira no Marketplace a
mesma URL atual e os quatro eventos selecionados, clique em **Validate** e
salve a assinatura. O `real-verify` local confirma apenas alcance e formato;
ele não ativa nem altera a configuração do Marketplace.

Durante a homologação local, `scripts/start-local-functions.ps1` isola
temporariamente `supabase/functions/.env` enquanto o watcher das Edge
Functions está ativo. Isso evita que a alteração do arquivo seja interpretada
como entrypoint pelo Supabase CLI; o arquivo é restaurado ao encerrar o
processo.

Atualização operacional: o arquivo `supabase/functions/.env` deve permanecer
no caminho original durante todo o processo. O webhook, o túnel e as Edge
Functions compartilham essa configuração; nenhuma etapa deve renomeá-lo.

## Existe sessao ativa antes do teste

Nao rode o teste real. Primeiro identifique e encerre a sessao pelo host ou pela
rotina operacional:

```bash
npm run zoom:video-sdk:emergency-end
npm run zoom:video-sdk:real-preflight
```

Se o estado temporario nao tiver `provider_session_id`, mas o preflight mostrar
exatamente uma sessao ativa, use:

```bash
npm run zoom:video-sdk:emergency-end -- --active-singleton
```

Se houver mais de uma sessao ativa, encerre manualmente no Zoom Build
Platform/API usando o procedimento oficial e repita o preflight.

## Cleanup nao foi comprovado

Pare novos testes. O script imprime IDs sanitizados e um procedimento manual.
Remova somente os registros temporarios marcados pelo `runId`, respeitando esta
ordem: participacoes, webhooks, video session, ledger, pagamentos, booking,
disponibilidade, servico, assinatura, perfis e Auth users. Depois rode as
consultas de prova indicadas no erro antes de tentar novamente.

## Rate limit de acesso bloqueou a entrada

O limite e intencional e distribuido no banco. Ele impede emissao repetida de
JWTs por booking/perfil/papel dentro de uma janela curta. Aguarde a janela
expirar ou investigue chamadas duplicadas no cliente antes de repetir.

## O orquestrador parou em `canonical_stripe_payment_e2e_pending`

Nao abra Zoom por fora. Esse bloqueio significa que ainda nao existe evidencia
de Checkout Stripe test, webhook assinado processado, pagamento `paid` e
`video_session` canonica para a booking. O harness tecnico com pagamento direto
so valida Zoom isoladamente e deve ser executado apenas com a flag diagnostica
documentada.
