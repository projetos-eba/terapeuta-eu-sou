---
name: patient-overview
description: Implementar e manter a visão geral autenticada do paciente TES.
---

# Visão geral do paciente

## Escopo

- Rotas: `/app` canônica e `/paciente/inicio` como compatibilidade explícita.
- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:2553` (`Page / Paciente / Início — Carlos`).
- Shell: `src/components/authenticated-shell/` e `src/app/(authenticated)/layout.tsx`.
- Página: `src/features/patient-overview/`.

## Fontes obrigatórias

1. `AGENTS.md`.
2. Figma node `13366:2553`.
3. `docs/product/sitemap.md` e `docs/product/routes-map.md`.
4. `docs/design-system/design-system.md` e `docs/design-system/tokens.md`.
5. `src/lib/routes.ts`, `src/lib/auth/patient-session.ts` e arquivos diretamente afetados.

## Dados

- Query única: `getPatientOverview(profileId)` em `patient-overview.queries.ts`.
- A query server-side usa `SUPABASE_SERVICE_ROLE_KEY`; tabelas lidas pela visão geral precisam de grants para `service_role` além das policies RLS dos fluxos autenticados.
- Dados de demonstração: `supabase/seed.sql` usando IDs estáveis.
- Estrutura: `supabase/migrations/20260723110000_patient_authenticated_overview.sql`.
- Equivalências existentes: `therapist_profiles`, `bookings`, `favorite_therapists`, `reviews` e `support_tickets`.
- Novas superfícies: `conversations`, `messages`, `notifications`, `mood_checkins`.
- O componente visual não deve consultar Supabase diretamente nem manter nomes, contadores ou agenda de demonstração.

## Comportamento

- O layout exige uma sessão de paciente; no desenvolvimento sem configuração Supabase, usa o perfil demo Carlos apenas para inspeção visual.
- O check-in de humor salva um único registro diário por paciente.
- Links de detalhes das subáreas mantêm as rotas canônicas planejadas em `src/lib/routes.ts`.
- Copy de cuidado é acolhedora e não faz promessa de cura, diagnóstico ou resultado.

## QA

- Conferir desktop com sidebar de 242px, topbar de 88px, coluna principal de 830px e lateral de 332px.
- Conferir tablet com lateral abaixo do conteúdo e mobile com drawer/empilhamento.
- Validar foco, landmarks, ícones com `aria-label` e botões reais.
- Rodar `npm run typecheck`, `npm run lint` e `npm run build`.
- Para validar migration e seed em ambiente local sem dados importantes: `npx supabase db reset`, depois `npx supabase db lint`.

## Pendências conhecidas

- A imagem exata do hero do Figma não está versionada localmente; usa-se o asset existente `/public/home/hero-section-realistic-fade.png` como adaptação temporária.
- As páginas de destino de algumas ações do shell serão implementadas nas próximas etapas autenticadas.
