---
name: public-for-therapists
description: Use when implementing, refactoring, auditing, or documenting the public `/para-terapeutas` landing page, including Figma node 13457:848, therapist plan catalog, responsive plan comparison, CTAs, Stripe/Billing boundaries, QA, and known pending work.
---

# Public For Therapists

## Fontes obrigatorias

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
- Nao implementar `/para-terapeutas/planos` nesta skill sem atualizar o escopo.
- Nao criar tabela visual independente: cards, tabela desktop e mobile devem consumir `PlanDefinition`.
- Enums tecnicos: `free`, `premium`, `premium_plus`.
- `pro` e `plus` sao prefixos de rota, nao valores de banco, Stripe ou catalogo.

## Planos e CTAs

- Free: `/cadastro?role=therapist&plan=free`.
- Premium: `/cadastro?role=therapist&plan=premium`.
- Premium Plus: `/cadastro?role=therapist&plan=premium_plus`.
- Frontend envia somente o codigo do plano.
- `stripePriceId` permanece `null` ate Billing ser implementado no backend.
- Nao aceitar preco, valor ou Price ID vindo do navegador.

## Copy responsavel

- Usar “Resumo operacional automatico” ou “Sugestoes baseadas em regras”.
- Nao usar “Resumo automatico com IA” sem IA real implementada.
- Evitar “ilimitado”; quando necessario, escrever “recursos completos sujeitos a politica de uso”.
- Precos pagos devem aparecer como “A partir de”.
- Nao prometer renda, cura, diagnostico, resultado garantido ou alteracao de comissao por plano.

## UI e responsividade

- Desktop: hero central, quatro itens de confianca em linha leve, bento grid na geometria do Figma, painel roxo de planos e tabela semantica com primeira coluna sticky; nao exibir cards de plano acima da tabela no desktop amplo.
- Tablet: cards dos planos acima da tabela; tabela com scroll horizontal controlado.
- Mobile: cards empilhados com CTA e accordion nativo “Ver todos os recursos”.
- CTAs devem ter pelo menos 44px de altura.

## Pendencias conhecidas

- `/para-terapeutas/planos` consumindo o mesmo catalogo.
- Migrations futuras `subscriptions` e `stripe_events`.
- Checkout Stripe, webhook idempotente, Customer Portal e liberacao server-side de plano.
- Decisoes comerciais: preco final, trial, prorata, tolerancia por falha de pagamento, upgrade imediato, downgrade/cancelamento no fim do ciclo.
- Assets do Figma foram substituidos por fallbacks locais em `public/for-therapists/` quando download direto nao estiver disponivel.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Validar `/para-terapeutas`.
- Validar CTAs com query params para `free`, `premium`, `premium_plus`.
- Validar que tabela desktop e cards mobile usam o mesmo catalogo.
- Validar visualmente desktop/mobile contra Figma `13457:848` quando browser/Playwright estiver disponivel.
