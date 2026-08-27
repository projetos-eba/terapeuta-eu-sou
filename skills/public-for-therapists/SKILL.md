---
name: public-for-therapists
description: Use when implementing, refactoring, auditing, or documenting the public `/para-terapeutas` landing page, including Figma node 13457:848, therapist plan catalog, responsive plan comparison, CTAs, Stripe/Billing boundaries, QA, and known pending work.
---

# Public For Therapists

## Fontes obrigatórias

Consultar antes de alterar:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13457:848`
3. `docs/product/sitemap.md`
4. `docs/design-system/design-system.md`
5. `docs/product/routes-map.md`
6. `src/lib/routes.ts`
7. `src/domain/tes/plan-definitions.ts`
8. `src/domain/tes/permissions.ts`
9. `src/app/para-terapeutas/page.tsx`
10. `src/features/for-therapists/`

## Contrato

- Rota: `/para-terapeutas`.
- Figma: `Page / Publico / Para Terapeutas`, node `13457:848`.
- Nao criar rota separada `/para-terapeutas/planos`; a decisão pública de planos acontece em `/para-terapeutas`.
- Nao criar tabela visual independente: cards, tabela desktop e mobile devem consumir `PlanDefinition`.
- Enums tecnicos: `free`, `premium`, `premium_plus`.
- `pro` e `plus` sao prefixos de rota, nao valores de banco, Stripe ou catalogo.

## Planos e CTAs

- Free: `/terapeuta/cadastro?plan=free`.
- Premium: `/terapeuta/cadastro?plan=premium`.
- Premium Plus: `/terapeuta/cadastro?plan=premium_plus`.
- Frontend envia somente o código do plano, nunca valor, Price ID ou oferta.
- Valores canônicos: Premium R$ 79,90/mês e Premium Plus R$ 129,90/mês.
- Nao aceitar preco, valor ou Price ID vindo do navegador.

## Copy responsavel

- Usar “Resumo operacional automatico” ou “Sugestoes baseadas em regras”.
- Nao usar “Resumo automatico com IA” sem IA real implementada.
- Evitar “ilimitado”; quando necessario, escrever “recursos completos sujeitos a politica de uso”.
- Preços pagos devem informar claramente a recorrência mensal.
- Nao prometer renda, cura, diagnostico, resultado garantido ou alteracao de comissao por plano.

## UI e responsividade

- Hero: usar o asset `public/for-therapists/hero-therapist-laptop.png` derivado do Figma node `13457:848`; o título "Você cuida de pessoas." deve usar Manrope semibold (`font-weight: 600`) e `text-brand-deep`.
- Desktop: hero central, quatro itens de confianca em linha leve, bento grid na geometria do Figma, painel roxo de planos e tabela semantica com recursos em linhas simples; nao exibir cards de plano acima da tabela no desktop amplo.
- A tabela desktop de planos não deve ter coluna editorial lateral. O primeiro cabeçalho da tabela fica visualmente vazio/somente acessível, os planos aparecem nas três colunas e o rodapé da tabela mostra valores e CTAs de cadastro por plano.
- Tablet: cards dos planos acima da tabela; tabela com scroll horizontal controlado.
- Mobile: cards empilhados com CTA e accordion nativo “Ver todos os recursos”.
- CTAs devem ter pelo menos 44px de altura.
- A matriz de planos deve exibir apenas o nome do recurso, sem descrições por linha. As descrições podem permanecer no catálogo para outros usos, mas não aparecem na tabela visual.
- Categorias atuais da matriz: `Operação — base de todos`, `Identidade & presença — a partir do Premium`, `Gestão da prática — exclusivo Plus` e `Academia TES (Em breve)`.
- Bento grid: evitar conteúdo cortado no desktop usando altura suficiente, padding interno generoso e imagem do card `Atenda de onde estiver` afastada das bordas.

## Pendencias conhecidas

- Homologar visualmente e transacionalmente os dois planos mensais no Stripe
  Test Mode. Live Mode recebe somente configuração e verificação de leitura.
- Assets do Figma foram substituidos por fallbacks locais em `public/for-therapists/` quando download direto nao estiver disponivel.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Validar `/para-terapeutas`.
- Validar CTAs com query params para `free`, `premium`, `premium_plus`.
- Validar que tabela desktop e cards mobile usam o mesmo catalogo.
- Validar visualmente desktop/mobile contra Figma `13457:848` quando browser/Playwright estiver disponivel.
