# Arquitetura de pagamentos TES

Atualizado em 2026-08-06.

## Visao geral

O TES separa dois fluxos Stripe:

- Stripe Billing: assinatura mensal dos terapeutas nos planos `premium` e
  `premium_plus`, com Checkout incorporado como fluxo principal e Checkout
  hospedado como contingencia.
- Stripe Connect: cobranca de sessoes na conta da plataforma, com separate charges and transfers e repasse posterior ao terapeuta.

O redirecionamento do Checkout nunca ativa plano nem confirma pagamento sozinho.
O estado local muda por webhooks assinados, reservados atomicamente e
idempotentes. Quando o retorno chega antes do webhook, a tela chama uma rota
autenticada de status que recupera a Checkout Session e a Subscription
diretamente na Stripe, valida `customer`, `client_reference_id`, metadata,
ambiente e Price ID, e aplica a mesma sincronizacao idempotente usada pelo
webhook. O parametro `checkout=success` continua sem autoridade propria.

## Rotas de retorno

- `/terapeuta/*` e o destino canonico de Checkout, Billing Portal e Connect.
- `/basico/*`, `/pro/*` e `/plus/*` nao devem ser fixados em Edge Functions;
  os retornos existentes foram migrados na Fase Agenda 1.
- A URL de retorno melhora a continuidade da jornada, mas nunca concede plano,
  capability, pagamento ou autorizacao.
- `/terapeutas/*` continua reservado ao catalogo publico.

## Configuracao Connect

- Dashboard: Express.
- Fee collection: your platform manages pricing.
- Negative balance liability: your platform.
- Charge pattern: separate charges and transfers.
- Pais de identidade da conta conectada: `identity.country = br`.
- Entidade inicial do onboarding hospedado: `identity.entity_type = individual`.
- Capacidade esperada para repasse: `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status = active`.
- A plataforma brasileira tambem solicita
  `configuration.merchant.capabilities.card_payments.requested = true` na
  criacao Accounts v2 porque a Stripe exige essa capability antes de aceitar
  `stripe_balance.stripe_transfers`. Isso nao muda o charge pattern do TES:
  sessoes continuam como cobranca na plataforma com separate charges and
  transfers, e o terapeuta nao recebe formulario local de cobranca.

Essa configuracao permite reter fundos antes de liberar repasse. Como a plataforma paga as taxas Stripe nesse fluxo, a taxa nao e descontada dos 80% devidos ao terapeuta.

## Modelo financeiro inicial

- Moeda: BRL.
- Dinheiro em centavos inteiros.
- Comissao TES: `2000` basis points.
- Terapeuta: `floor(gross_amount_cents * 8000 / 10000)`.
- TES: valor bruto menos valor do terapeuta.
- Taxa Stripe: custo da TES, conciliado posteriormente por Charge/Balance Transaction.

As regras ficam em `financial_policy_versions`. A versao inicial e `tes-payments-v1`:

- cancelamento gratuito ate 24h antes da sessao;
- cancelamento tardio: 50% retido e 50% reembolsado;
- no-show: 50% retido e 50% reembolsado;
- reembolsos antes de lote/transferencia podem ser automaticos; casos ja loteados, transferidos, disputados ou contestados entram em revisao manual;
- confirmacao automatica da sessao apos 30 dias;
- prazo de seguranca de 7 dias apos confirmacao antes de elegibilidade para repasse;
- lote semanal terca-feira 10:00 America/Sao_Paulo, com cutoff explicito e periodo unico por indice idempotente;
- upgrades de assinatura cobram prorrata imediatamente; downgrades e cancelamentos entram no fim do periodo.
- Premium Plus para Premium cria Subscription Schedule e registra o plano/data
  futuros na metadata da assinatura local e remota para projeção consistente.
- cancelamento usa `cancel_at_period_end`, libera eventual schedule de
  downgrade e preserva o plano efetivo ate o fim pago; a mesma funcao aceita
  reversao autenticada e idempotente com `cancel_at_period_end = false`.

## Dados principais

- `billing_plans` e `billing_plan_prices`: catalogo local de planos e Price IDs Stripe.
- `stripe_customers`: Customer local por perfil, papel e ambiente.
- `therapist_subscriptions`: assinatura paga do terapeuta.
- `therapist_connect_accounts`: conta conectada e status operacional.
- `session_payments`: fonte financeira canonica das sessoes.
- `session_payment_attempts`: tentativas idempotentes de cobranca.
- `session_refunds`, `session_cancellation_decisions` e `session_disputes`: eventos compensatorios, decisoes de politica e bloqueios. Cancelamento usa `request_id` único e o RPC `claim_session_cancellation_decision_v1` (somente `service_role`) para registrar uma única decisão antes de chamar Stripe; retries reutilizam a decisão, a chave de idempotência do refund e a transição do booking.
- `session_service_confirmations`: prova de realizacao da sessao.
- `payout_batches`, `payout_batch_therapists`, `payout_batch_items`: lote semanal.
- `stripe_transfers` e `stripe_transfer_reversals`: repasses e compensacoes.
- `financial_ledger_entries`: ledger auditavel.
- `stripe_webhook_events`: recebimento idempotente de webhooks.

Desde o Gate F0:

- `session_payments` atualiza `payments`, `bookings.payment_status` e
  `booking_payment_receipts` por projeção transacional;
- `service_role` não escreve diretamente em `payments`;
- registros legados são importados de forma idempotente e ficam bloqueados para
  repasse até a reconciliação recuperar o Charge de origem;
- o plano da assinatura é resolvido pelo `stripe_price_id` efetivo, nunca apenas
  pela metadata enviada ao Checkout.

Agenda e Sessões:

- `therapist_session_read_model_v1` lê estado financeiro e realização
  diretamente de `session_payments`;
- divergência em `bookings.payment_status` não autoriza acesso Zoom;
- filtros financeiros de Sessões usam `session_financial_status`;
- o frontend não escreve estado financeiro nem confirma pagamento por
  redirect.

## Estados

Pagamento da sessao:

- `pending`, `processing`, `paid`, `failed`, `canceled`, `partially_refunded`, `refunded`, `disputed`.

Realizacao do servico:

- `scheduled`, `occurred_pending_confirmation`, `confirmed_by_patient_review`, `confirmed_by_therapist`, `auto_confirmed`, `contested`, `canceled`, `not_performed`.

Repasse:

- `not_eligible`, `waiting_confirmation`, `waiting_safety_period`, `eligible`, `batched`, `transfer_pending`, `transferred`, `blocked`, `reversed`, `failed`.

## Fluxos

```mermaid
sequenceDiagram
  participant T as Terapeuta
  participant TES as Edge Functions TES
  participant S as Stripe
  participant DB as Supabase

  T->>TES: criar checkout de assinatura
  TES->>DB: valida terapeuta e plano
  TES->>S: cria Checkout Session subscription
  S-->>T: client_secret do Checkout incorporado ou URL hospedada de fallback
  S->>TES: webhook assinado
  TES->>DB: atualiza therapist_subscriptions
  TES->>DB: ativa therapist_profiles.plan se estado Stripe permitir
  T->>TES: retorno success consulta status autenticado
  TES->>S: recupera Checkout Session/Subscription
  TES->>DB: reconcilia se a Stripe confirmar assinatura paga valida
  TES-->>T: retorna status active e atualiza cookie auxiliar de plano
  T->>T: redireciona para /terapeuta sem recriar Checkout
```

```mermaid
sequenceDiagram
  participant P as Paciente
  participant TES as Edge Functions TES
  participant S as Stripe
  participant DB as Supabase
  participant T as Terapeuta

  P->>TES: pagar sessao
  TES->>DB: busca preco do servico
  TES->>DB: grava snapshot financeiro
  TES->>S: cria Checkout Session payment
  S->>TES: webhook pagamento confirmado
  TES->>DB: session_payments.financial_status = paid
  T->>TES: confirma realizacao
  TES->>DB: service_status = confirmed_by_therapist
  TES->>DB: calcula eligible_at + 7 dias
  TES->>S: cria Transfer no processamento do lote
  Note over TES,S: Transfer usa source_transaction = Charge da sessão
```

## Edge Functions

Billing:

- `stripe-sync-billing-catalog`
- `stripe-create-subscription-checkout`
- `stripe-subscription-checkout-status`
- `stripe-change-therapist-subscription`
- `stripe-cancel-therapist-subscription`
- `stripe-create-billing-portal`
- `stripe-billing-webhook`

Connect:

- `stripe-connect-create-account`
- `stripe-connect-create-account-link`
- `stripe-connect-create-login-link`
- `stripe-connect-sync-account`
- `stripe-connect-webhook`

Sessoes e repasses:

- `session-booking-checkout`
- `session-reschedule`
- `stripe-create-session-payment`
- `request-session-cancellation`
- `confirm-session-by-therapist`
- `auto-confirm-sessions`
- `evaluate-transfer-eligibility`
- `create-weekly-payout-batch`
- `process-payout-batch`
- `retry-failed-payout-items`
- `reconcile-stripe-transfers`

`session-booking-checkout` é a fronteira autenticada da reserva pública:
exige paciente derivado da sessão, `serviceId`, `startsAt`, `requestId` e
aceite obrigatório dos termos. O checkout de sessão usa Stripe Embedded
Checkout: `stripe-create-session-payment` cria a Checkout Session server-side e
retorna apenas o `clientSecret` necessário para montar o componente oficial da
Stripe. O retorno visual da Stripe não confirma pagamento; somente webhook
assinado atualiza `session_payments` e o booking.

## Shell financeiro do terapeuta

F0/F1 implementa `/terapeuta/financeiro` com quatro abas: Resumo,
Recebimentos, Repasses e Conta de recebimento. A tela é operacional e
disponível para Free, Premium e Premium Plus quando houver movimentação
financeira.

F2 adiciona métricas intermediárias na aba Resumo para Premium e Premium Plus
via `advanced_metrics`: receita líquida comparada ao período anterior, ticket
médio, sessões pagas/realizadas, retorno simples, cancelamentos,
reagendamentos, faturamento por terapia e evolução financeira realizada versus
período anterior. Free continua com o resumo operacional.

F3 adiciona o dashboard avançado Premium Plus via `advanced_financials`:
previsão do mês, potencial disponível da agenda, oportunidade do mês, Insight
TES determinístico, retenção por coorte, evolução com projeção, ranking
detalhado por terapia. Benchmark não é exibido na experiência financeira do
terapeuta. Realizado, contratado e estimado permanecem separados; projeções não
criam ledger, saldo ou repasse.

F4 fecha o ciclo operacional em test mode: conta Connect ativa, pagamento de
sessao confirmado exclusivamente por webhook Stripe, reconciliacao do Charge,
confirmacao da realizacao, periodo de seguranca controlado somente por flag
server-side de teste, elegibilidade, criacao de lote, Transfer com
`source_transaction`, conclusao do repasse, dashboard atualizado e
comprovantes/reconciliacao visiveis. O retorno da Stripe continua sem autoridade
para confirmar pagamento, onboarding ou repasse.

Read models privados:

- `get_private_therapist_financial_overview_v1`;
- `get_private_therapist_receipts_v1`;
- `get_private_therapist_payouts_v1`;
- `get_private_therapist_connect_account_v1`;
- `get_private_therapist_financial_metrics_v1` para métricas F2 Premium e
  Premium Plus;
- `get_private_therapist_advanced_financial_dashboard_v1` e contratos
  segmentados F3 para Premium Plus.

Todos derivam terapeuta de `auth.uid()`, retornam centavos inteiros e não
expõem linhas cruas. O frontend formata valores, mas não calcula saldos
autoritativos. Conta de recebimento usa Stripe Connect hospedado; retorno da
Stripe pede sincronização e nunca marca onboarding como concluído.

Documentos de contrato:

- `docs/payments/therapist-finance-f0-f1.md`;
- `docs/architecture/adr/ADR-013-therapist-finance-f2-metrics.md`;
- `docs/architecture/adr/ADR-014-therapist-finance-f3-advanced-dashboard.md`;
- `docs/architecture/adr/ADR-015-therapist-finance-f4-operational-payout-lifecycle.md`.

## Execucao local

1. Configure secrets em `supabase/functions/.env.local`.
2. Rode Supabase local e functions:

```bash
npx supabase start
npm run dev:functions
```

3. Valide ambiente:

```bash
npm run payments:env
npm run payments:env -- catalog
npm run payments:env -- platform-webhook
```

4. Sincronize catalogo:

```bash
npm run payments:catalog:sync
npm run payments:catalog:verify
```

5. Encaminhe webhooks:

```bash
npm run payments:webhooks:listen
```

Para homologacao conjunta de pagamento de sessao e Zoom Video SDK, use:

```bash
npm run homologation:zoom:local
```

O orquestrador captura o signing secret do Stripe CLI sem imprimi-lo e o injeta
somente no processo local das Edge Functions. A sessao Zoom real fica bloqueada
ate haver evidencia nao secreta de `checkout.session.completed`/PaymentIntent
processado, `session_payments.financial_status = paid` e `video_sessions`
criada pelo fluxo canonico.

Runbooks complementares:

- `docs/payments/stripe-secrets-setup.md`: obtencao e rotacao de secrets Stripe.
- `docs/payments/internal-operations-token.md`: geracao, uso, teste e rotacao do token machine-to-machine.

## Webhooks tratados

Configuracao detalhada para o Dashboard Stripe:
`docs/payments/stripe-secrets-setup.md`.

`stripe-billing-webhook`, escopo `Sua conta`:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.finalization_failed`
- `payment_intent.processing`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `transfer.updated`
- `transfer.reversed`

`stripe-connect-webhook`, escopo `Contas conectadas`, payload snapshot:

- `account.updated`

`stripe-connect-webhook`, escopo `Contas conectadas`, payload thin Accounts v2:

- `v2.core.account.created`
- `v2.core.account.updated`
- `v2.core.account.closed`
- `v2.core.account[configuration.merchant].updated`
- `v2.core.account[configuration.merchant].capability_status_updated`
- `v2.core.account[configuration.recipient].updated`
- `v2.core.account[configuration.recipient].capability_status_updated`
- `v2.core.account[defaults].updated`
- `v2.core.account[identity].updated`
- `v2.core.account[requirements].updated`
- `v2.core.account[future_requirements].updated`

## Secrets Stripe

- `STRIPE_SECRET_KEY`: unica chave usada pelas Edge Functions e scripts de catalogo. Aceita chave secreta `sk_*` ou chave restrita `rk_*`; rejeita chave publicavel `pk_*`. O modo `test`/`live` e inferido da propria chave.
- `STRIPE_WEBHOOK_SECRET`: fallback local para os webhooks de plataforma e Connect.
- `STRIPE_PLATFORM_WEBHOOK_SECRET`: segredo especifico do endpoint de Billing/sessoes, preferido em staging/producao.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: segredo especifico do endpoint Connect, preferido em staging/producao.
- `STRIPE_CONNECT_V2_WEBHOOK_SECRET`: segredo do destino thin de Accounts v2.
- `PAYMENTS_INTERNAL_OPERATIONS_TOKEN`: token apenas machine-to-machine para rotinas privadas de cron/ops. O catalogo pode ser sincronizado pelo script local sem esse token.

Nao usar `STRIPE_RESTRICTED_API_KEY` nem `STRIPE_ENVIRONMENT` neste projeto. O app Next.js nao deve receber secret Stripe.

O fallback de `STRIPE_WEBHOOK_SECRET` existe para desenvolvimento local. Em
staging/producao, configurar `STRIPE_PLATFORM_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET` e `STRIPE_CONNECT_V2_WEBHOOK_SECRET`
separadamente; se um fallback for usado, a Edge Function registra alerta
operacional sem imprimir o secret.

## Documentos e escopo fiscal

O TES, nesta versao, nao emite nota fiscal. Para cobranca e comprovacao de pagamento, sao utilizadas invoices e recibos gerados pela Stripe. Esses documentos nao devem ser apresentados como substitutos de nota fiscal.

Assinaturas de terapeutas usam invoices do Stripe Billing, com `hosted_invoice_url`, PDF da invoice ou Billing Portal quando disponiveis. Pagamentos de sessoes usam recibos da Charge/PaymentIntent, incluindo `receipt_url` quando a Stripe gerar esse comprovante. Transfers Connect e payouts bancarios sao comprovantes operacionais distintos e tambem nao sao notas fiscais.

Nao implementar, nesta etapa, integracao com prefeitura, emissor fiscal, NFS-e nacional ou emissao em nome dos terapeutas. A fronteira futura deve permanecer desacoplada do dominio financeiro.

## Pendencias comerciais

- Validacao contabil/juridica antes de qualquer emissao fiscal futura.
- Regras de excecao manual para casos de terapeuta responsavel por cancelamento ou remarcacao especial.

## Recuperacao operacional

- Webhooks com `processing_status = failed` podem ser reprocessados por rotina administrativa futura usando `stripe_event_id`.
- Pagamentos sem taxa Stripe conciliada devem ser encontrados por `stripe_fee_amount_cents is null`.
- Sessoes bloqueadas aparecem por `transfer_status = blocked` e `transfer_blocked_reason`.
- Transfers com falha aparecem por `stripe_transfers.status = failed` e `payout_batch_items.status = failed`.
- Pagamentos importados sem Charge ficam com
  `transfer_blocked_reason = source_charge_reconciliation_required` e são
  resolvidos por `reconcile-stripe-transfers`.
- Controles temporais de teste (`nowOverride` e `cutoffAtOverride`) exigem
  `TES_FINANCE_TEST_CONTROLS_ENABLED=true`, Stripe em `test` mode e token
  interno valido; em live mode falham fechado.
- Repasses conciliados devem carregar `stripe_transfer_id` e
  `stripe_source_charge_id`, permitindo verificar que o Transfer foi criado com
  `source_transaction`.
