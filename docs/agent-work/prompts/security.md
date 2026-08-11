# Prompt — Security & Supabase

```text
Use o agente customizado `security_supabase`.

OBJECTIVE
[auditoria ou mudança de segurança/Supabase]

SCOPE
[migrations, RPCs, RLS, grants, Auth, Storage ou Edge Functions afetadas]

Leia AGENTS.md, docs/agent-work e as fontes do domínio. Confirme owner funcional,
consumidores e contrato antes de editar. Derive identidade de auth.uid()/sessão
confiável, aplique menor privilégio e preserve histórico. Revise SECURITY
DEFINER/search_path, IDOR, service role, grants, policies, Storage, idempotência
e auditoria.

Se houver migration, assuma ownership final do arquivo e da ordem; exija teste
pgTAP/RLS e compatibilidade/roll-forward. Não faça mudança destrutiva ou ação em
HML/produção sem gate humano. Entregue HANDOFF_TEMPLATE.md completo com testes
positivos e negativos.
```
