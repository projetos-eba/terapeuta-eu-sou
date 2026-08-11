# Prompt — Stripe & Finance

```text
Use o agente customizado `stripe_finance`.

OBJECTIVE
[resultado financeiro verificável]

SCOPE
[Billing, Connect, session payment, refund, dispute, ledger, payout ou UI]

Leia AGENTS.md, docs/agent-work, docs/payments e as skills financeiras. Preserve
session_payments como autoridade de pagamentos de sessão, ledger append-only,
centavos inteiros, idempotência e separate charges and transfers. Redirect não
confirma nada; use webhook assinado/reconciliação autenticada.

Use test mode por padrão. Cubra duplicidade, fora de ordem, retry, erro e
reconciliação. Declare impacto em booking, paciente, terapeuta, Admin, Zoom e
ledger. Encaminhe migrations a Security & Supabase e UI aos owners do shell.
Entregue handoff sem secrets ou identificadores externos completos.
```
