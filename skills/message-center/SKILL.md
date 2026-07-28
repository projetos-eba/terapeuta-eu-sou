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
- Terapeuta: `/terapeuta/mensagens`.
- Aliases `/basico/mensagens`, `/pro/mensagens` e `/plus/mensagens` continuam
  redirects para `/terapeuta/mensagens`.

## Regra crítica

Mensagens não são chat livre. Nunca adicionar `textarea`, composer aberto,
anexo livre ou envio de corpo arbitrário entre cliente e terapeuta.

Fluxos permitidos:

- cliente -> terapeuta: templates aprovados;
- terapeuta -> cliente: templates aprovados;
- cliente -> plataforma: categorias de suporte;
- terapeuta -> plataforma: categorias de suporte.

## Contratos atuais

- Leitura de cliente/terapeuta: `conversations` e `messages`.
- Plataforma/suporte: `support_tickets` e `notifications`.
- Envio de template entre participantes: `POST /api/messages/send-template`.
- Templates permitidos ficam em
  `src/features/message-center/message-center.templates.ts`.

`/api/messages/send-template` deve ignorar qualquer texto vindo do navegador e
resolver o corpo da mensagem pelo `templateKey` server-side.

## UI

- Seguir o Figma `13366:7083`: hero com imagem à direita no desktop, métricas
  tintadas, duas seções principais, lista de participantes e lista de
  plataforma/suporte.
- Dentro do shell real, não recriar sidebar ou topbar do Figma.
- Usar `TESDialog` para seleção de templates.
- Responsivo: uma coluna no mobile/tablet e duas colunas no desktop largo.
- Usar tokens TES (`text-brand-deep`, `text-tesText-secondary`,
  `border-brand-lavender`, `bg-brand-lavenderSoft`) e ícones `lucide-react`.

## Segurança e privacidade

- Não expor notas clínicas, Match, secrets, dados financeiros internos ou URL
  secreta de sala.
- Não permitir conversa livre direta para evitar fraude, assédio, desvio de
  pagamento ou uso indevido da plataforma.
- Suporte não deve ser gravado por atalho client-side sem policy ou Edge
  Function específica.

## QA

- Validar `/app/mensagens` e `/terapeuta/mensagens`.
- Verificar que não existe input de texto livre.
- Verificar abertura/fechamento do `TESDialog`, foco e `Escape`.
- Rodar `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`.

## Pendências conhecidas

- Criar fluxo server-side dedicado para abertura de chamados de suporte por
  template, se produto quiser gravar `support_tickets` diretamente.
- Migrar ou desabilitar a policy legada que permite insert livre em `messages`
  quando houver decisão de banco para hardening definitivo.
