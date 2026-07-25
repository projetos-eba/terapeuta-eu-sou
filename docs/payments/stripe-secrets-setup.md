# Setup de secrets Stripe para pagamentos TES

Atualizado em 2026-07-25.

Este documento descreve como obter e configurar os secrets Stripe usados pelas Supabase Edge Functions de pagamentos. Nunca salve valores reais em Git, `.env.example`, frontend ou logs.

## Variaveis

| Variavel                             | Finalidade                                                          | Origem                                                                 | Local                                                                              | Producao                                            | Rotacao                                                             |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Chamadas server-side para API Stripe                                | Dashboard Stripe em Developers/API keys, ou chave restrita equivalente | Obrigatoria para catalogo, Checkout, Billing, Connect e transfers                  | Obrigatoria                                         | Conforme politica de acesso; preferir `rk_*` com permissoes minimas |
| `STRIPE_WEBHOOK_SECRET`              | Assinatura do listener local da Stripe CLI                          | Saida de `stripe listen`                                               | Obrigatoria para webhooks locais quando endpoint-specific secrets nao forem usados | Nao preferencial                                    | Ao recriar o listener                                               |
| `STRIPE_PLATFORM_WEBHOOK_SECRET`     | Assinatura do endpoint de eventos da conta TES                      | Workbench/Webhooks/Event destinations                                  | Opcional com fallback local                                                        | Obrigatoria para ambiente publicado                 | Pelo Dashboard Stripe                                               |
| `STRIPE_CONNECT_WEBHOOK_SECRET`      | Assinatura do endpoint de eventos das contas conectadas             | Workbench/Webhooks/Event destinations                                  | Opcional com fallback local                                                        | Obrigatoria para ambiente publicado                 | Pelo Dashboard Stripe                                               |
| `STRIPE_CONNECT_V2_WEBHOOK_SECRET`   | Assinatura do destino thin de Accounts v2                           | Workbench/Event destinations                                           | Opcional; usa fallback Connect/local                                               | Obrigatoria quando o destino thin estiver publicado | Pelo Dashboard Stripe                                               |
| `PAYMENTS_INTERNAL_OPERATIONS_TOKEN` | Autorizacao machine-to-machine para cron, lote, retry e conciliacao | Gerado internamente                                                    | Conforme uso das rotinas internas                                                  | Conforme uso das rotinas internas                   | Politica interna; gerar novo valor e atualizar chamadores           |

`STRIPE_SECRET_KEY` aceita `sk_test_*`, `sk_live_*`, `rk_test_*` ou `rk_live_*`. Chaves `pk_*` sao publicaveis e devem ser rejeitadas nessa variavel.

## URLs locais reais

Com `supabase/config.toml` atual, as URLs locais dos webhooks sao:

| Endpoint                      | URL local                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| Plataforma, Billing e sessoes | `http://127.0.0.1:54321/functions/v1/stripe-billing-webhook` |
| Connect                       | `http://127.0.0.1:54321/functions/v1/stripe-connect-webhook` |

As rotinas de desenvolvimento usam `supabase/functions/.env.local`, `supabase/functions/.env` ou `.env.local`, nessa ordem.

## Desenvolvimento local com Stripe CLI

1. Inicie o Supabase local:

```powershell
npx supabase start
```

2. Inicie as Edge Functions:

```powershell
npm run dev:functions
```

3. Autentique a Stripe CLI:

```powershell
stripe login
```

4. Inicie o listener local para plataforma e Connect:

```powershell
npm run payments:webhooks:listen
```

O script executa:

```powershell
stripe listen `
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,invoice.payment_action_required,payment_intent.processing,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,transfer.updated,transfer.reversed `
  --forward-to http://127.0.0.1:54321/functions/v1/stripe-billing-webhook `
  --forward-connect-to http://127.0.0.1:54321/functions/v1/stripe-connect-webhook
```

5. Copie o `whsec_*` exibido pela Stripe CLI para `supabase/functions/.env.local`:

```dotenv
STRIPE_WEBHOOK_SECRET=
```

6. Reinicie as Edge Functions depois de alterar o arquivo de env.

7. Dispare eventos de teste:

```powershell
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger payment_intent.succeeded
# Antes do proximo comando, defina $connectedAccountId com um stripe_account_id real de teste.
stripe trigger account.updated --stripe-account $connectedAccountId
```

Use no `$connectedAccountId` um `stripe_account_id` real criado ou reutilizado por `stripe-connect-create-account` no ambiente de teste autorizado. Nao identificado nos arquivos analisados. A resposta esperada dos webhooks e HTTP 200 com persistencia idempotente em `stripe_webhook_events`.

## Ambiente publicado: webhook da plataforma

1. Acesse o Dashboard Stripe da conta TES.
2. Abra Workbench.
3. Abra Webhooks ou Event destinations.
4. Crie um novo destino.
5. Selecione `Events on your account`.
6. Selecione somente os eventos usados por `stripe-billing-webhook`.
7. Informe a URL publica da Edge Function `stripe-billing-webhook` do projeto Supabase publicado.
8. Crie o destino.
9. Abra o destino criado e revele o signing secret.
10. Armazene o valor como `STRIPE_PLATFORM_WEBHOOK_SECRET` nos secrets remotos das Edge Functions.

Nao foi identificado nos arquivos analisados o project ref publico do Supabase publicado; por isso a URL publica exata deve ser copiada do ambiente publicado antes da configuracao no Dashboard Stripe.

## Ambiente publicado: webhook Connect

1. Crie outro destino no Workbench.
2. Selecione `Events on connected accounts`.
3. Para compatibilidade snapshot, selecione `account.updated`.
4. Informe a URL publica da Edge Function `stripe-connect-webhook` do projeto Supabase publicado.
5. Crie o destino.
6. Abra o destino criado e revele o signing secret.
7. Armazene o valor como `STRIPE_CONNECT_WEBHOOK_SECRET` nos secrets remotos das Edge Functions.
8. Teste com uma conta conectada da area autorizada.

## Ambiente publicado: destino thin Accounts v2

1. Crie um novo Event destination para eventos de contas conectadas.
2. Em Payload style, selecione `Thin`.
3. Selecione os eventos `v2.core.account*` usados pela integração, incluindo
   `v2.core.account.updated`, requirements, recipient updates, capability status
   e account closed.
4. Use a mesma URL pública de `stripe-connect-webhook`.
5. Armazene o signing secret próprio como
   `STRIPE_CONNECT_V2_WEBHOOK_SECRET`.
6. Não reutilize o secret do destino snapshot.

Cada endpoint possui seu proprio secret `whsec_*`. Secrets gerados pela Stripe CLI e pelo Dashboard nao sao equivalentes e nao devem ser compartilhados entre ambientes.

## Token operacional interno

`PAYMENTS_INTERNAL_OPERATIONS_TOKEN` nao e credencial Stripe e nao e obtido no Dashboard Stripe. Ele protege rotinas como:

- `auto-confirm-sessions`
- `evaluate-transfer-eligibility`
- `create-weekly-payout-batch`
- `process-payout-batch`
- `retry-failed-payout-items`
- `reconcile-stripe-transfers`

O token deve ser enviado somente no header:

```http
x-tes-internal-operations-token: <valor>
```

Gere pelo menos 32 bytes aleatorios:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Armazene o valor em secrets Supabase. Nunca envie por query string e nunca registre o valor em logs.
