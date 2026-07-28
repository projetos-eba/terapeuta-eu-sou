# ADR-009 — Online-Only Delivery Policy

Data: 2026-07-28

## Status

Aceita.

## Contexto

O produto TES foi definido como uma plataforma exclusivamente online. Durante a
auditoria foram identificados campos e contratos que ainda permitiam representar
`in_person` e `hybrid`, especialmente em `therapist_services.delivery_format`,
`therapist_services.online_only`, filtros de sessões e formulário de serviços.

Esses valores vinham de compatibilidade técnica e de fases anteriores, mas não
correspondem ao escopo aprovado do produto.

## Decisão

O TES aceita apenas atendimento online.

- `delivery_format` permanece no banco como campo legado, mas seu único valor
  válido é `online`.
- `online_only` permanece por compatibilidade, mas deve ser sempre `true`.
- `accepts_online_sessions` permanece por compatibilidade, mas deve ser sempre
  `true`.
- `modality` pode continuar em read models antigos, mas deve aceitar/expor
  somente `online`.
- UI, rotas, filtros, seeds, analytics e documentação funcional não devem
  oferecer escolha de local ou formato.
- Zoom Video SDK continua sendo o provedor operacional atual do encontro online.

## Consequências

- Serviços existentes são backfilled para `online` sem apagar histórico de
  bookings, pagamentos ou snapshots.
- Constraints e triggers impedem gravações incompatíveis.
- A Edge Function `therapist-services-command` rejeita payloads explícitos
  `in_person` ou `hybrid`.
- A RPC `get_therapist_sessions_v1` preserva `p_modality` apenas como parâmetro
  legado: `null` e `online` são aceitos; qualquer outro valor falha.
- A tela “Suas terapias” informa “Atendimento online” como regra fixa.
- A tela de sessões do terapeuta não oferece filtro de modalidade.

## Compatibilidade

Não remover colunas legadas nesta decisão. A remoção física só pode ocorrer em
fase futura com plano de migração, auditoria de dados reais e confirmação de que
nenhum cliente, view, RPC, analytics ou dashboard consome esses campos.

## Guardrail

`npm run lint:online-only` executa
`scripts/validate-online-only-policy.mjs`, que bloqueia novas ocorrências
funcionais de copy e valores técnicos não-online fora de allowlist explícita.

## Impacto Documental

Documentação atualizada em:

- `AGENTS.md`;
- `README.md`;
- `docs/product/glossary.md`;
- `docs/product/integration-map.md`;
- `docs/product/page-inventory.md`;
- `docs/product/routes-map.md`;
- `skills/therapist-services/SKILL.md`.
