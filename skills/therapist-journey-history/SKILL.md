# Histórico da Jornada do Terapeuta

## Escopo

Use esta skill ao alterar a página autenticada de Histórico da Jornada do shell do terapeuta.

Rotas:

- `/terapeuta/pacientes`
- `/terapeuta/pacientes/[patientId]`

Perfil/plano:

- Terapeuta autenticado com capability `full_crm` (`Premium Plus`).
- A rota usa `therapistRoutePolicies.patients` e `requireTherapistSession`.

## Fontes Obrigatórias

- `AGENTS.md`
- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:8765`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/therapist-journey-history/*`
- `src/features/therapist-shell/therapist-route-policy.ts`

## Contrato Visual

O node Figma `13366:8765` define:

- Título visual `Clientes` dentro da navegação `Histórico da Jornada`.
- Métricas no topo: total de clientes, ativos, novos no mês, sem sessão recente.
- Lista de clientes com busca, filtros, ordenação, status, terapias, última/próxima sessão, encontros e temas recorrentes.
- Rail lateral com resumo da carteira, segmentos e lembretes.
- Visual claro, premium, bordas lavanda, sombra suave, tipografia display IvyPresto para títulos.

## Dados

A página não cria uma nova autoridade clínica ou financeira. A leitura é derivada de:

- `therapist_patient_relationships`
- `bookings`
- `patient_profiles`
- `therapist_services`
- `booking_session_summaries`

Regras:

- Não buscar e-mail de pacientes via `profiles`; a policy padrão só garante leitura do próprio profile.
- Não exibir chat livre.
- Links de comunicação devem apontar para `/terapeuta/mensagens`, que usa templates.
- Links de sessões devem usar `/terapeuta/sessoes?patient=<patientProfileId>`.
- Detalhes de sessão devem usar `/terapeuta/sessoes/[bookingId]`.

## Responsividade

- Desktop: tabela larga com rail lateral.
- Tablet/mobile: lista cronológica em cards, filtros empilhados e ações grandes.
- Evitar texto sobreposto, largura fixa frágil e cards aninhados.

## Copy Responsável

- Não prometer cura, diagnóstico, resolução emocional ou resultado garantido.
- Usar linguagem operacional: jornada, encontros, registros, continuidade, cuidado.
- Deixar claro que a timeline é operacional e não substitui prontuário clínico.

## QA

- Rodar `npm run typecheck`.
- Rodar `npm run lint`.
- Rodar `npm run test`.
- Rodar `npm run build` quando o ambiente permitir.
- Para alteração visual, validar desktop e mobile em `/terapeuta/pacientes` com terapeuta Premium Plus local quando houver Supabase/dev server disponível.

## Pendências Conhecidas

- O Figma mostra e-mail do cliente, mas a implementação atual usa rótulo seguro (`timezone`/`Cliente TES`) para respeitar as policies existentes.
- Segmentos são inferidos de títulos/resumos/serviços, sem criar taxonomia clínica nova.
