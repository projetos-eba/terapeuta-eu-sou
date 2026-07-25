---
name: therapist-dashboard
description: Implementar e manter o dashboard autenticado do terapeuta nos planos Básico, Premium e Premium Plus sem duplicar shell, dados ou regras de acesso.
---

# Dashboard do terapeuta

## Fontes obrigatórias

1. `AGENTS.md`.
2. Figma `Projeto Terapeuta Eu Sou Atualizado`.
3. `docs/product/sitemap.md`.
4. `docs/design-system/design-system.md`.
5. `docs/product/routes-map.md`.
6. `docs/product/integration-map.md`.
7. `docs/product/page-inventory.md`.
8. `src/lib/routes.ts`.
9. `src/domain/tes/plan-definitions.ts`.
10. `src/domain/tes/permissions.ts`.

## Figma

- Página Premium Plus: node `13366:7600`.
- Nome: `Page / Terapeuta / Início Premium Plus`.
- Hero: node `13366:7602`.
- Aura: node `13366:7726`.

## Rotas

- Básico: `/basico`.
- Premium: `/pro`.
- Premium Plus: `/plus`.
- Os namespaces são preservados e usam o mesmo shell interno.

## Componentes e dados

- Shell: `src/components/authenticated-shell`.
- Configuração: `src/features/therapist-shell`.
- Dashboard: `src/features/therapist-dashboard`.
- Sessão: `src/lib/auth/therapist-session.ts`.
- Read model: RPC `public.get_therapist_dashboard_v1()`.
- Recomendações: `public.aura_recommendations`, consultadas separadamente.
- Assets locais: `public/therapist/dashboard/`.

Não distribuir queries pelos componentes. A entrada única da página é
`getTherapistDashboardPage({ profileId, accessToken })`.

## Regras

- `premium_plus` é superset funcional.
- Autorização usa access token e RLS; o cookie de plano é somente hint.
- Não usar service role no app Next.
- Não expor visitante individual em analytics.
- Não usar dados privados do paciente para recomendações da Aura.
- Métricas devem ser calculadas dos registros transacionais.
- Usar “Pagamentos pendentes” para bookings `pending_payment`.
- Não prometer cura, diagnóstico ou resultado.

## Fallbacks

- Sem bookings: métricas zeradas e agenda vazia.
- Sem analytics: visitas zeradas.
- Sem reviews: estado vazio explícito.
- Sem recomendações: dashboard principal continua disponível.
- Supabase indisponível: mensagem segura sem payload interno.
- Sessão inválida: redirecionar para `/terapeuta/login`.
- Plano divergente: redirecionar para o namespace canônico.
- Suspenso ou rejeitado: bloquear o dashboard.

## QA

- `npx supabase db reset`.
- `npm run typecheck`.
- `npm run lint`.
- `npm run test`.
- `npm run build`.
- Login local com `ana.oliveira@example.test`.
- Validar desktop, tablet e mobile.
- Confirmar drawer, foco visível, item ativo, badges e logout.
- Confirmar que todos os links do menu evitam 404.
- Confirmar RLS entre Ana, Rafael e paciente.
- Confirmar idempotência do seed.

## Pendências conhecidas

- `/plus` é a experiência profunda desta etapa.
- Demais rotas usam estado “Em construção” até seus respectivos frames e
  contratos funcionais serem implementados.
- `/pro` e `/basico` usam wrappers compartilhados e serão aprofundados sem
  duplicar o dashboard.
