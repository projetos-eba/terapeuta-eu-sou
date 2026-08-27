---
name: message-center
description: Implementar e manter a Central de Mensagens do paciente e do terapeuta com comunicação por templates, sem chat livre.
---

# Central de Mensagens TES

## Fontes obrigatórias

1. `AGENTS.md`.
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13366:7083`
   (`Page / Central de mensagens`).
3. `docs/product/sitemap.md`.
4. `docs/product/routes-map.md`.
5. `docs/product/page-inventory.md`.
6. `docs/design-system/design-system.md`.
7. `docs/product/integration-map.md`.

## Rotas

- Paciente: `/app/mensagens`.
- Detalhe de suporte do paciente: `/app/mensagens/suporte/:ticketId`.
- Terapeuta: `/terapeuta/mensagens`.
- Detalhe de suporte do terapeuta: `/terapeuta/mensagens/suporte/:ticketId`.
- A subrota autenticada `/terapeuta/mensagens/solicitar-terapia` é um fluxo
  estruturado de sugestão de catálogo; ela não é chat nem permite mensagens
  livres entre pacientes e terapeutas.
- Aliases `/basico/mensagens`, `/pro/mensagens` e `/plus/mensagens` continuam
  redirects para `/terapeuta/mensagens`.

## Regra crítica

Mensagens não são chat livre. Nunca adicionar `textarea`, composer aberto,
anexo livre ou envio de corpo arbitrário entre cliente e terapeuta.

Fluxos permitidos:

- cliente -> terapeuta: templates aprovados;
- terapeuta -> cliente: templates aprovados;
- cliente -> plataforma: ticket de suporte autorizado;
- terapeuta -> plataforma: ticket de suporte autorizado.

O histórico de participante pode ser aberto em um painel de leitura com todas
as mensagens da conversa, mantendo o envio entre paciente e terapeuta limitado
aos templates aprovados. CTAs de encontro/sessão devem sempre apontar para as
rotas canônicas do perfil atual, nunca para o perfil público do terapeuta.

## Contratos atuais

- Leitura de cliente/terapeuta: `conversations` e `messages`.
- Plataforma: `notifications`. Suporte: `support_tickets` e `support_ticket_messages`, exibidos em seção própria para paciente e terapeuta.
- Prévia server-side de mensagem: `POST /api/messages/preview-template`.
- Envio de template entre participantes: `POST /api/messages/send-template`.
- Abertura de chamado de suporte: `POST /api/support/tickets`.
- Leitura segura do sino do shell: `GET /api/notifications`.
- Marcação de avisos como lidos: `POST /api/notifications/mark-read`.
- Templates permitidos ficam em
  `src/features/message-center/message-center.templates.ts`.

Uma conversa é única por par paciente-terapeuta. O banco a cria e faz backfill
para todo booking `confirmed` ou `completed`; a Central não limita a lista de
destinatários. `booking_id` preserva apenas o contexto autorizado mais relevante
para templates que exigem sessão — não transforma a conversa em um chat por
sessoes individuais.

`/api/messages/preview-template` e `/api/messages/send-template` aceitam apenas
`actorRole`, `conversationId`, `bookingId`, `templateKey` e parâmetros fechados.
Campos `body`, `message`, `description`, `html`, Markdown, URLs e texto livre são
rejeitados. A RPC V2 valida direção, conversa, booking, opções e CTA; resolve o
corpo e a rota canônica no banco. A prévia não persiste nada e o envio persiste
somente o corpo e metadata resolvidos pelo servidor.

`/api/notifications/mark-read` deve aceitar somente usuário autenticado, limitar
marcação em massa ao `profile_id` do próprio usuário e nunca alterar avisos de
outro perfil.

`GET /api/notifications` lê somente itens do perfil autenticado por cookies
HTTP-only. O shell consulta a cada três segundos enquanto a aba estiver visível;
não expor token no navegador nem usar Realtime direto.

`/api/support/tickets` aceita categoria controlada, assunto e descrição plain
text em ticket autorizado. A identidade vem da sessão, o `bookingId` é
validado contra o solicitante e `requestId` mantém idempotência. O detalhe e a
resposta usam `/api/support/tickets/:ticketId`; a thread vive em
`support_ticket_messages` e não compartilha tabelas, composer ou endpoint com
participantes.

Cada card de chamado apresenta categoria, assunto, última mensagem pública,
badge de quem precisa agir, última atualização e protocolo persistido. Não usar
UUID como protocolo e não duplicar chamados em avisos da plataforma.

## UI

- Seguir o Figma `13366:7083`: hero com imagem à direita no desktop, métricas
  tintadas, duas seções principais, lista de participantes e lista de
  plataforma/suporte.
- Dentro do shell real, não recriar sidebar ou topbar do Figma.
- Usar `TESDialog` para o formulário de novo chamado; composer livre só existe
  no detalhe de suporte, nunca na seção de participantes.
- Responsivo: uma coluna no mobile/tablet e duas colunas no desktop largo.
- Usar tokens TES (`text-brand-deep`, `text-tesText-secondary`,
  `border-brand-lavender`, `bg-brand-lavenderSoft`) e ícones `lucide-react`.
- Na lista de participantes, a ação `Ver mensagens` fica alinhada à linha da
  pessoa, sem criar uma faixa vertical separada abaixo do conteúdo.
- O CTA genérico de visualização (`Ver sessão`/`Ver encontro`) não aparece na
  linha nem no detalhe da conversa; somente ações contextuais, como abrir,
  reagendar ou orientações de cancelamento, permanecem disponíveis quando
  autorizadas.
- Títulos de conversas e avisos da plataforma são acionáveis e abrem um
  painel de leitura em `TESDialog`; o histórico continua bidirecional e os
  avisos permanecem somente leitura.
- Ações da central usam `TESButton` e suas variantes canônicas, mantendo a
  diferença de hierarquia entre ação primária, secundária e título acionável.
- O popover global do sino representa tipos conhecidos de aviso com ícones
  semânticos (`message_received`, `review`, `reschedule`, sessão, pagamento e
  suporte); tipos futuros usam `Bell` como fallback sem quebrar a leitura.

## Segurança e privacidade

- Não expor notas clínicas, Match, secrets, dados financeiros internos ou URL
  secreta de sala.
- Não permitir conversa livre direta para evitar fraude, assédio, desvio de
  pagamento ou uso indevido da plataforma.
- Suporte deve ser gravado somente pelo endpoint autenticado
  `/api/support/tickets` e pelas policies de `support_tickets`; atalhos
  client-side não podem simular protocolo em produção. Thread, resposta pública
  e nota interna usam o contrato separado de Support Ticketing; nota interna
  nunca integra a leitura do solicitante.

## QA

- Validar `/app/mensagens` e `/terapeuta/mensagens`.
- Verificar que não existe input de texto livre entre participante e terapeuta.
- Verificar criação, lista, detalhe e resposta do ticket de suporte do
  paciente e do terapeuta, inclusive estado resolvido e mobile.
- Verificar histórico bidirecional do participante e o CTA de encontro/sessão.
- Verificar que `Ver sessão`/`Ver encontro` genérico não aparece nos tickets de
  participante, tanto no fluxo terapeuta-paciente quanto no paciente-terapeuta.
- Verificar que `Ver mensagens` permanece na linha/coluna de ações do
  participante e que o título da conversa abre o mesmo histórico.
- Verificar que o título de um aviso de plataforma abre seu detalhe em
  `TESDialog`, sem criar chat ou composer livre.
- Verificar que o sino da topbar abre o popover acessível, mantém a Central de
  mensagens como destino completo e fecha por `Escape` ou clique externo.
- Verificar que o popover do sino usa a camada global do shell e permanece acima
  do conteúdo da página, sem vazamento de texto ou sobreposição de stacking.
- Verificar marcação de notificações como lidas por clique real.
- Verificar que o popover apresenta ícone coerente para cada tipo de aviso e
  mantém o título e o ponto de não lida legíveis em desktop e mobile.
- Verificar que aviso temporário aparece apenas para encontro confirmado e
  respeita `prefers-reduced-motion`.
- Verificar abertura/fechamento do `TESDialog`, foco e `Escape`.
- Verificar abertura real de chamado plain text autorizado e feedback com
  protocolo.
- Rodar `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`.

## Pendências conhecidas

- A Fase 1 fechou a escrita direta de `messages`. A Fase 4 adiciona a RPC V2,
  catálogo categorizado, descrições de uso, parâmetros de opções fechadas,
  contexto de booking, prévia e CTAs allowlisted. A V1 continua disponível como
  wrapper compatível e permanece server-authoritative.
- Publicar SLAs e canais oficiais antes de expor `/ajuda` como superfície
  pública.

## Assets da plataforma

- O hero seleciona `patientMessagesHero` ou `therapistMessagesHero` conforme
  `actorRole`, sem alterar os contratos de leitura ou envio.
- Consulte `docs/design-system/platform-assets.md`.
