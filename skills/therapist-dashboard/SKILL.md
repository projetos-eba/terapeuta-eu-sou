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
- Cada etapa do checklist é uma única área de link acessível, com foco visível,
  navegação por teclado e área de toque mínima de 44px. O comportamento é o
  mesmo em mobile, tablet e desktop; não há link aninhado apenas no ícone.
- Read model: RPC `public.get_therapist_dashboard_v1()`.
- O percentual do perfil exibido no dashboard vem do readiness canônico do
  editor (`therapist_profile_completeness_json_m1`); valores legados retornados
  pelo RPC não podem rebaixar esse estado nem manter um item de atenção quando
  o perfil está 100% completo.
- Aura Premium Plus: o dashboard consome `get_therapist_aura_signals_v1(30)`
  pelo mesmo serviço server-only da página `/terapeuta/assessor-ia`; não
  consultar `public.aura_recommendations` diretamente em componentes ou em um
  segundo contrato. Assim, regras, período, dismissals e filtros de origem
  demonstrativa permanecem iguais nas duas superfícies.
- Assets locais: `public/therapist/dashboard/`.

## Dados temporais do painel

- A visão “Sua semana” é derivada de `get_therapist_calendar_v1` na visão
  semanal, usando `timezone` e `range.localStart` retornados pelo contrato.
  Os estados de booking continuam sendo classificados conforme o domínio
  transacional.
- “Próximas sessões” usa `get_therapist_agenda_v1` em uma janela de até 90
  dias, ordena os horários crescentes e mostra data, horário, pessoa e terapia.
  Uma falha de leitura fica explícita e não vira lista vazia.
- O card de próximas sessões mantém data e horário em uma pilha compacta, com
  espaçamento curto e legível entre as duas linhas.
- O gráfico semanal usa tooltip TES, resumo textual acessível e tokens CSS, sem
  valores de referência inventados.
- Para Free, “Ver mais” abre uma explicação no próprio painel e encaminha
  somente para o plano Premium, nunca para `/terapeuta/insights`.
- O diálogo de recurso bloqueado usa a anatomia editorial compartilhada de
  upgrade: selo do plano, asset de apoio, título, descrição, benefícios e ações.
  Em mobile, a imagem aparece antes do título; em desktop, ela ocupa a coluna
  lateral sem esconder a copy ou as ações.

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
  essencial, o envio dos documentos obrigatórios, a conclusão do cadastro
  Stripe Connect e a aprovação administrativa. Enquanto a aprovação estiver
  pendente, o checklist permanece visível mesmo com 100% de conclusão real.
- Stripe Connect é item obrigatório. Conta inexistente, cadastro incompleto,
  requisitos pendentes, conta restrita ou desabilitada mantêm o checklist ativo.
  Depois que o onboarding for submetido, a análise externa pode ser exibida
  como estado do cadastro; isso não deve ser confundido com a aprovação
  administrativa do perfil.
- A aprovação administrativa não compõe a pendência do percentual de cadastro:
  `submitted` e `in_review` deixam o item de perfil completo, mas visivelmente
  em análise. `changes_requested` e `rejected` voltam a ser pendência em estado
  de atenção, e o link do perfil deve permitir ler a justificativa recebida.
- Free/Premium com checklist essencial concluído recebem dashboard base com
  estados vazios úteis; não consultar o read model Premium Plus para esses
  planos.
- Não usar service role no app Next.
- Não expor visitante individual em analytics.
- Não usar dados privados do paciente para recomendações da Aura.
- Métricas devem ser calculadas dos registros transacionais.
- Usar “Pagamentos pendentes” para bookings `pending_payment`.
- Na comunicação com o terapeuta, usar “Sessão”, “Terapia”, “Métricas” e
  “Assessora Aura”; termos de implementação como booking, insight e serviço
  ficam restritos a contratos, logs e documentação.
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

- `npx supabase start` sem resetar o banco local.
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

No onboarding, clicar no texto, descrição, estado ou ícone de cada etapa deve
levar ao mesmo destino; validar também Tab/Enter e foco visível em 1440px,
1024px e 390px.

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
