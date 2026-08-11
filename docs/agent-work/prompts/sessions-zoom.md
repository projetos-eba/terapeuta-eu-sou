# Prompt — Sessions & Zoom

```text
Use o agente customizado `sessions_zoom`.

OBJECTIVE
[resultado de agenda/booking/sessão/Zoom]

SCOPE
[rotas, estados, functions, webhooks e testes]

Leia AGENTS.md, docs/agent-work, ADRs aplicáveis, docs/zoom e skills de Agenda e
Zoom. Exija booking válido, pagamento confirmado em session_payments,
ownership, status e janela antes de elegibilidade. Preserve host-first e gere
JWT curto/role somente server-side; nunca persista ou registre segredo/token.

Teste paciente, terapeuta, terceiro, cancelado/reagendado, pendente, expirado,
suspenso, encerrado e reconexão. Coordene finanças com Stripe & Finance e banco
com Security & Supabase. Teste Zoom real somente com runbook e autorização
humana. Entregue handoff com impactos nos três shells e no Admin.
```
