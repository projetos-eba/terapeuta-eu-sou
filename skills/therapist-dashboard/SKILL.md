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

- Canônica para todos os planos: `/terapeuta`.
- Compatibilidade temporária: `/basico`, `/pro` e `/plus`.
- A variação de dashboard é definida por plano e capability, não pelo path.

## Componentes e dados

- Shell: `src/components/authenticated-shell`.
- Configuração: `src/features/therapist-shell`.
- Dashboard: `src/features/therapist-dashboard`.
- Sessão: `src/lib/auth/therapist-session.ts`.
- Readiness: `getTherapistHomeReadiness({ session })`, derivado de
  `therapist_profiles`, conteúdo publicado/rascunho, serviços ativos,
  disponibilidade e Stripe Connect.
- Onboarding: quando a prontidão essencial ou os documentos obrigatórios ainda
  não foram concluídos,
  `TherapistGettingStartedPage` apresenta o progresso circular, as etapas
  reais, pendências de documentos, resumo do perfil e orientação de análise.
  Os documentos privados são resumidos apenas como estado e encaminham para
  `/terapeuta/configuracoes`, que é a área canônica de envio; não duplicar
  upload, URLs ou dados privados no dashboard.
- Read model: RPC `public.get_therapist_dashboard_v1()`.
- Recomendações: `public.aura_recommendations`, consultadas separadamente.
- Assets locais: `public/therapist/dashboard/`.

Não distribuir queries pelos componentes. A entrada única da página é
`getTherapistHomeReadiness({ session })`; quando o terapeuta está operacional e
é Premium Plus aprovado, carregar o dashboard completo por
`getTherapistDashboardPage({ profileId, accessToken })`.

## Regras

- `premium_plus` é superset funcional.
- Autorização usa access token e RLS; o cookie de plano é somente hint.
- `/terapeuta` deve primeiro mostrar checklist para perfil publicado, terapias
  ativas, agenda configurada, documentos obrigatórios enviados e onboarding do
  Stripe Connect concluído.
- A transição para o dashboard normal acontece somente após a prontidão
  essencial, o envio dos documentos obrigatórios e a conclusão do cadastro
  Stripe Connect. A verificação externa
  continua sendo exibida como estado do cadastro e não é tratada como aprovação
  automática.
- Stripe Connect é item obrigatório. Conta inexistente, cadastro incompleto,
  requisitos pendentes, conta restrita ou desabilitada mantêm o checklist ativo.
  Depois que o onboarding for submetido, uma análise externa em andamento pode
  ser exibida como estado do cadastro sem bloquear a entrada.
- Free/Premium com checklist essencial concluído recebem dashboard base com
  estados vazios úteis; não consultar o read model Premium Plus para esses
  planos.
- Não usar service role no app Next.
- Não expor visitante individual em analytics.
- Não usar dados privados do paciente para recomendações da Aura.
- Métricas devem ser calculadas dos registros transacionais.
- Usar “Pagamentos pendentes” para bookings `pending_payment`.
- Na comunicação com o terapeuta, usar “Sessão”, “Terapia”, “Resultados” e
  “Assessora Aura”; termos de implementação como booking, insight, serviço ou
  métricas ficam restritos a contratos, logs e documentação.
- Não prometer cura, diagnóstico ou resultado.

## Fallbacks

- Sem bookings: métricas zeradas e agenda vazia.
- Sem analytics: visitas zeradas.
- Sem reviews: estado vazio explícito.
- Sem recomendações: dashboard principal continua disponível.
- Supabase indisponível: mensagem segura sem payload interno.
- Sessão inválida: redirecionar para `/terapeuta/login`.
- Capability indisponível: mostrar dashboard base/estado vazio quando a rota for
  `/terapeuta`; redirecionar para `/terapeuta` apenas em rotas protegidas por
  capability específica.
- Suspenso ou rejeitado: bloquear o dashboard.

## QA

- `npx supabase db reset`.
- `npm run typecheck`.
- `npm run lint`.
- `npm run test`.
- `npm run build`.
- Login local com `ana.oliveira@example.test`.
- Validar desktop, tablet e mobile.
- No onboarding, validar o anel de progresso, checklist, pendências,
  resumo de perfil e rail de orientação em 1440px, 1024px e 390px, sem rolagem
  horizontal.
- Confirmar drawer, foco visível, item ativo, badges e logout.
- Confirmar que todos os links do menu evitam 404.
- Confirmar RLS entre Ana, Rafael e paciente.
- Confirmar idempotência do seed.

## Pendências conhecidas

- Premium Plus aprovado é a experiência profunda desta etapa dentro de
  `/terapeuta`.
- Dashboard base após todas as etapas obrigatórias ainda não possui todos os read models
  reais de Free/Premium; deve manter métricas vazias honestas até os contratos
  transacionais dessas superfícies evoluírem.
- Demais rotas usam estado “Em construção” até seus respectivos frames e
  contratos funcionais serem implementados.
- Premium e Free usam wrappers compartilhados e serão aprofundados sem duplicar
  o dashboard.

## Assets da plataforma

- O hero operacional usa `therapistDashboardHero` alinhado à direita, com fade
  curto à esquerda e sem borda decorativa. Consulte
  `docs/design-system/platform-assets.md`.
