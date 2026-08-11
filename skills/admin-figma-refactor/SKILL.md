---
name: admin-figma-refactor
description: Use ao refatorar telas admin do Terapeuta Eu Sou a partir do Figma, especialmente quando a meta for maior fidelidade visual, padronização de cards/tabelas/filtros, responsividade e preservação de dados reais sem expor mensagens de desenvolvimento no front-end.
---

# Admin Figma Refactor

Use esta skill para refatorações visuais e de UX em `/admin/*` guiadas pelo
Figma do projeto.

## Fontes obrigatórias

- `AGENTS.md`
- Figma node específico solicitado pelo usuário
- `docs/product/routes-map.md`
- `docs/design-system/design-system.md`
- `docs/product/page-inventory.md`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-operations/*`
- Skill local da página/domínio, quando existir

## Workflow

1. Carregar o skill `figma-design-to-code` antes de usar `get_design_context`.
2. Buscar o node do Figma informado pelo usuário e registrar o node ID usado.
3. Comparar o Figma com o contrato real de dados da rota antes de editar.
4. Mapear cada elemento visual para uma destas categorias:
   - dado real disponível;
   - dado derivável com segurança do payload atual;
   - dado indisponível que deve virar estado honesto;
   - incompatibilidade que exige aviso ao usuário antes de mudança estrutural.
5. Implementar visual com tokens TES, sem hex hardcoded e sem criar rota nova.
6. Remover qualquer copy técnica do front-end: nomes de tabela, read model,
   stack, ambiente, debug, mock, seed, TODO, erro interno ou jargão de dev.
7. Atualizar a skill local da página/domínio com decisões, node Figma e
   pendências de dados.
8. Validar com `typecheck`, `lint`, testes direcionados, `build` e Playwright
   MCP quando aplicável.

## Padrões visuais admin

- Cabeçalho editorial: eyebrow `Admin`, título display italic e subtítulo curto.
- KPIs: cards brancos, radius 24px, sombra suave, ícone em superfície tintada,
  valor grande e descrição de produto.
- Cards analíticos: título `text-lg font-extrabold`, ícone `size-11` em
  `bg-brand-lavenderSoft`, corpo denso e sem textos de bastidor.
- Tabelas: card branco único, filtros no topo, headers compactos, mobile cards.
- Estados indisponíveis: explicar em linguagem de produto, sem falar de
  implementação.

## Regras de dados

- Nunca inventar números, deltas, séries temporais, avaliações, ticket médio,
  planos, sessão futura ou responsável quando o payload não trouxer.
- Dado derivado deve ser simples, rastreável e calculado somente do payload
  renderizado.
- Zero resultado não é erro e não ativa fallback.
- Demo/mock/seed não pode aparecer no front-end.

## QA mínimo

- `npm run typecheck`
- `npm run lint`
- `npm run test -- admin-operations.mappers admin-operations.queries admin-shell-config`
- `npm run build`
- Playwright MCP:
  - abrir a rota local impactada em viewport desktop e mobile quando houver
    sessão autenticada compatível;
  - capturar screenshot full-page;
  - validar ausência de overflow horizontal, textos cortados, cards desalinhados
    e mensagens de desenvolvimento;
  - quando não houver sessão/admin local disponível, registrar o bloqueio sem
    afirmar validação visual executada.
- Busca textual por termos proibidos no front-end tocado:
  `read model|mock|seed|debug|TODO|localhost|Fonte:|contrato de dados`
