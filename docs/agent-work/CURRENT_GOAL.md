# Current Goal

## Goal

Refinar visualmente o primeiro lote Admin do TES usando as quatro referências
fornecidas em 2026-08-11 como direção visual, preservando contratos reais,
rotas, permissões e estados operacionais.

## Scope

- `/admin/profissionais/[professionalId]`;
- `/admin/pacientes/[patientId]`;
- `/admin/profissionais/verificacoes` e seu detalhe;
- `/admin/pagamentos`.

As referências são visuais. Métricas, deltas, séries, pessoas, avaliações,
anotações, objetivos e valores só podem aparecer quando existirem no contrato
real consumido pela rota.

## Success Criteria

- As quatro superfícies usam grid, hierarquia, cards, filtros e tabelas
  consistentes com os padrões Admin do Figma e do Design System TES.
- Nenhuma tela exibe termos de desenvolvimento ou fontes técnicas.
- Dados e ações inexistentes nas referências são omitidos ou substituídos por
  conteúdo real e funcional.
- Loading, empty, forbidden, unavailable e error permanecem honestos.
- Desktop e mobile não possuem overflow horizontal ou ações inacessíveis.
- Skills locais, handoffs e release gate registram as decisões e validações.

## Constraints

- Não alterar schema, migration, RLS, Auth, rota ou permissão.
- Não criar série temporal, delta percentual, receita agregada, avaliação,
  retenção, objetivo clínico, anotação ou documento que o payload não entregue.
- Não expor conteúdo clínico, documentos privados, PII desnecessária, IDs
  externos completos ou mensagens técnicas.
- Não criar branch, worktree, commit, push ou PR sem autorização humana
  específica.
- Preservar alterações locais preexistentes.

## Critical Paths

1. Auditar referências, Figma e contratos reais de cada rota.
2. Reservar arquivos sem sobreposição entre People Operations e Financeiro.
3. Implementar People Operations e Financeiro em fluxos independentes.
4. Executar self-tests, reviews de domínio e integração.
5. Validar navegação real, responsividade, acessibilidade e estados com QA.

## Agents

- `orchestrator`: coordenação, integração e artefatos da sprint.
- `admin`: owner de detalhes de profissional/cliente e verificações.
- `stripe_finance`: owner funcional da experiência de `/admin/pagamentos`.
- `qa_release`: baseline, regressão e release gate.
- `security_supabase`: não acionado enquanto não houver impacto em dados,
  autorização, schema ou backend.

## Dependencies

- Figma `13425:1020`, `13425:1394` e padrões Admin `12857:666`.
- `skills/admin-figma-refactor`, `skills/admin-people-operations` e
  `skills/admin-finance-subscriptions`.
- Contratos atuais de `admin_get_operation_*` e `admin_get_finance_*`.
- Sessão admin local compatível para QA visual autenticado.

## Release Gate

Estado atual desta meta: `NOT_READY`. Implementação, revisões de domínio,
typecheck, lint, testes focados e build foram concluídos. O gate E2E autenticado
permanece pendente porque o Supabase local deixou de estar disponível durante a
reexecução; a comparação visual adicional em desktop e mobile também não pôde
ser concluída no Browser MCP.
