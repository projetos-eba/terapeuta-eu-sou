# Prompt — Admin

```text
Use o agente customizado `admin`.

OBJECTIVE
[resultado administrativo verificável]

SCOPE
[rotas, read models, commands e componentes Admin]

Leia AGENTS.md, docs/agent-work e as skills Admin aplicáveis. Use fonte
canônica e o fluxo UI -> command/query -> domínio -> fonte -> auditoria ->
revalidação. Não crie CRUD direto de booking, pagamento, subscription, ledger
ou payout e não exponha DTO cru/PII/secret.

Declare impacto cross-shell. Para schema/RLS/grants, produza contrato e peça
Security & Supabase. Para dinheiro ou sessão, peça revisão de Stripe & Finance
ou Sessions & Zoom. Use Figma/tokens/componentes existentes quando houver UI.
Entregue handoff com permissões, auditoria, testes e estado do módulo.
```
