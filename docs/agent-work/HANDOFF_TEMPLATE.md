# Handoff Template

Copie o bloco abaixo sem remover seções. Use fatos e evidências; escreva
`Nenhuma` quando não houver impacto.

```md
STATUS

IMPLEMENTED | BLOCKED | NEEDS_REVIEW | READY_FOR_QA

SCOPE

<objetivo e limites do trabalho>

FILES CHANGED

<lista completa, incluindo arquivos compartilhados>

DB CHANGES

<migration, schema, RLS, grants, tipos gerados ou Nenhuma>

PUBLIC CONTRACT CHANGES

<rotas, DTOs, APIs, eventos, cache ou Nenhuma>

CROSS-DOMAIN IMPACT

<paciente, terapeuta, Admin, Stripe, Zoom, Match, terapias, serviços>

SECURITY IMPACT

<authn/authz, RLS, secrets, PII, auditoria, Storage ou Nenhum>

TESTS

<comando, resultado e evidência; separar não executados com motivo>

KNOWN RISKS

<P0/P1/P2/P3, limitações e rollback/roll-forward>

NEEDS FROM OTHER AGENTS

<owner, decisão/artefato necessário e blocker associado>

SAFE TO INTEGRATE?

YES | NO | WITH CONDITIONS

<condições ainda necessárias>
```

`READY_FOR_QA` não equivale a `DONE`. O Orchestrator integra somente após as
revisões aplicáveis, e QA registra o estado em `RELEASE_GATE.md` ou em uma cópia
da checklist vinculada à entrega.
