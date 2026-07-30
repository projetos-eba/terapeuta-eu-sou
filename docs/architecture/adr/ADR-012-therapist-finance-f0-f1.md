# ADR-012 — Financeiro do terapeuta F0/F1

Data: 2026-07-28

## Status

Aceita para implementação local.

## Contexto

O shell do terapeuta precisa de uma área financeira operacional, com dados
reais e compatível com Stripe Connect em test mode. O Figma de referência
inclui cards, tabelas, abas e uma tela visual de conta de recebimento, mas
também sugere elementos fora do escopo atual, como histórico dedicado,
projeções, oportunidades, inteligência financeira e formulário bancário local.

O domínio financeiro já possui fundação transacional:

- `session_payments` como fonte canônica dos pagamentos de sessão;
- `financial_policy_versions` com política de comissão, confirmação e repasse;
- `session_refunds`, `session_disputes` e `session_service_confirmations`;
- `payout_batches`, `payout_batch_therapists`, `payout_batch_items`;
- `stripe_transfers` e `stripe_transfer_reversals`;
- `financial_ledger_entries`;
- `therapist_connect_accounts`;
- Edge Functions Stripe Billing, Connect, sessões e repasses.

## Decisão

A área financeira do terapeuta terá somente quatro abas:

- Resumo;
- Recebimentos;
- Repasses;
- Conta de recebimento.

Não haverá aba dedicada de histórico nesta fase. Registros antigos permanecem
acessíveis pelas listas paginadas de Recebimentos e Repasses com filtro por
período.

`session_payments` permanece a fonte financeira canônica. O frontend e as rotas
Next não usam `bookings.payment_status` para determinar saldo, pagamento,
elegibilidade, reembolso ou repasse.

Valores financeiros são retornados em centavos inteiros e calculados em read
models privados no banco. O navegador apenas formata valores e estados.

A composição aprovada é:

- Valor bruto das sessões;
- menos Comissão TES;
- menos Reembolsos ao cliente, somente quando existirem;
- igual Valor líquido do terapeuta.

Não existe linha genérica de correção manual na composição visual do terapeuta.
Taxa Stripe é custo da TES no modelo atual e não aparece como desconto do
terapeuta.

Operação financeira essencial fica disponível para terapeutas Free, Premium e
Premium Plus quando houver movimentação financeira. A capability
`advanced_financials` fica reservada para fases futuras de projeções,
benchmarks, análises e insights avançados.

Conta de recebimento usa Stripe Connect hospedado. O TES não implementa
formulário próprio para dados bancários, KYC, documentos, CPF, CNPJ ou Pix. O
shell apenas inicia ou continua Account Link, sincroniza a conta e, quando
ativa, cria Login Link server-side.

Redirect de retorno da Stripe não confirma onboarding. A UI deve sincronizar e
mostrar o estado derivado de `therapist_connect_accounts`.

Para contas Connect Accounts v2 criadas em test mode na plataforma brasileira,
o payload canônico inclui `identity.country = br`, `identity.entity_type =
individual`, `configuration.recipient.capabilities.stripe_balance.stripe_transfers`
e `configuration.merchant.capabilities.card_payments`. A exigência de
`card_payments` é uma restrição da Stripe para liberar `stripe_transfers`; ela
não altera a decisão de produto de usar Checkout/cobrança na plataforma e
separate charges and transfers para sessões.

## Contratos

Foram aprovados quatro read models privados, todos derivando o terapeuta de
`auth.uid()`:

- `get_private_therapist_financial_overview_v1`;
- `get_private_therapist_receipts_v1`;
- `get_private_therapist_payouts_v1`;
- `get_private_therapist_connect_account_v1`.

Esses contratos retornam DTOs JSON versionados, não linhas cruas do Supabase.
Leitura cruzada entre terapeutas deve falhar por autorização no banco e no
serviço server-side.

## Consequências

- Fase 1 entrega operação financeira, não inteligência financeira.
- O shell pode ser usado por qualquer plano para dinheiro real do terapeuta.
- Uma conta Stripe pode existir sem estar pronta para receber; a UI precisa
  representar conta inexistente, onboarding incompleto, requisitos pendentes,
  análise, conta pronta, restrição e falha.
- O status financeiro continua dependente de webhooks assinados e
  sincronizações server-side, nunca de URL de retorno.
- A tela visual de conta do Figma é referência de densidade e hierarquia, mas o
  formulário bancário local é explicitamente rejeitado.

## Riscos

- Homologação Stripe Connect real exige secrets e fluxo externo em test mode.
- Alguns métodos de pagamento podem aparecer como “Não informado” quando o dado
  não estiver persistido em `session_payments.metadata`.
- Read models de repasse dependem de lotes processados e transfers já
  reconciliados para refletir a operação completa.

## Referências

- `docs/payments/architecture.md`;
- `docs/payments/therapist-finance-f0-f1.md`;
- `skills/payments-billing/SKILL.md`;
- Figma `Z42SR0Pi0m307SmcAkDqHb`, frames `14242:1347`, `14340:6279`,
  `14246:1347`, `14340:6282`.
