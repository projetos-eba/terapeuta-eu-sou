# Token interno de operacoes de pagamentos

Atualizado em 2026-07-25.

`PAYMENTS_INTERNAL_OPERATIONS_TOKEN` protege chamadas machine-to-machine de pagamentos que nao devem ser acionadas pelo navegador nem por usuarios finais. Ele nao e credencial Stripe, nao e obtido no Dashboard Stripe e nunca deve aparecer em logs, URLs, cookies, metadados Stripe ou banco de dados.

## Quando usar

Use somente quando a rotina nao puder ser protegida melhor por JWT administrativo, service role em chamada controlada ou autorizacao por papel:

- execucao de lote por cron;
- retry automatizado;
- reconciliacao;
- confirmacao automatica de sessoes;
- rotinas operacionais internas;
- scripts administrativos locais controlados.

Endpoints atuais que exigem o header:

- `auto-confirm-sessions`
- `evaluate-transfer-eligibility`
- `create-weekly-payout-batch`
- `process-payout-batch`
- `retry-failed-payout-items`
- `reconcile-stripe-transfers`

`evaluate-transfer-eligibility` e `create-weekly-payout-batch` aceitam
sobrescrita de horario/corte somente para homologacao financeira controlada
quando `TES_FINANCE_TEST_CONTROLS_ENABLED=true` e a chave Stripe estiver em
test mode. Em live mode ou sem a flag explicita, qualquer override temporal deve
falhar.

`stripe-sync-billing-catalog` aceita o token apenas quando chamado como automacao interna; administradores autenticados tambem podem chamar o endpoint com JWT e papel `admin`.

## Quando nao usar

Nao use este token:

- no navegador;
- em componentes React;
- por usuarios finais;
- como substituto de permissao administrativa normal;
- por query string;
- em URL;
- em cookie;
- em logs;
- em metadata Stripe;
- no banco de dados.

## Geracao

Gere um valor diferente por ambiente. Prefira 48 bytes em base64url:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Alternativa PowerShell:

```powershell
$bytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Alternativa OpenSSL:

```bash
openssl rand -base64 48
```

## Armazenamento

Localmente, salve apenas em arquivo nao versionado das Edge Functions:

```dotenv
PAYMENTS_INTERNAL_OPERATIONS_TOKEN=
```

Em ambientes publicados, use os secrets remotos da Supabase. `.env.example` deve conter somente a variavel vazia.

Para sandbox financeiro controlado:

```dotenv
TES_FINANCE_TEST_CONTROLS_ENABLED=false
```

Ativar como `true` apenas em ambiente de teste, nunca em producao.

## Uso

Envie o header:

```http
x-tes-internal-operations-token: <valor>
```

Os handlers devem validar o header antes de qualquer operacao, rejeitar token ausente/vazio, comparar em tempo constante e responder com erro generico. Nao aceitar outro nome de header sem necessidade arquitetural registrada.

## Rotacao

1. Pausar temporariamente os jobs chamadores.
2. Gerar novo token.
3. Atualizar o secret das Edge Functions.
4. Reiniciar ou publicar as funcoes.
5. Atualizar os chamadores.
6. Executar um teste controlado.
7. Reativar os jobs.
8. Invalidar o valor anterior.

Nao registrar hash parcial, prefixo, tamanho ou qualquer fragmento do token.

## Teste

Para testar sem expor o valor:

```powershell
$headers = @{ "x-tes-internal-operations-token" = $env:PAYMENTS_INTERNAL_OPERATIONS_TOKEN }
Invoke-RestMethod -Method Post -Headers $headers -Uri "http://127.0.0.1:54321/functions/v1/auto-confirm-sessions"
```

Se o secret estiver ausente ou divergente, a resposta esperada e `401` com mensagem generica de acesso operacional.

## Troubleshooting

- `operations_token_required`: conferir se o secret existe no runtime da Edge Function e se o header foi enviado.
- `method_not_allowed`: usar `POST`.
- `missing_supabase_env`: confirmar Supabase local/publicado e service role injetada no runtime.
- Falha intermitente em cron: rotacionar token nos chamadores e functions na mesma janela operacional.
