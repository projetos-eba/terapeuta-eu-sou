---
name: zoom-video-call
description: Implementar e validar as salas dedicadas de videochamada Zoom para paciente e terapeuta no TES.
---

# Sala dedicada de videochamada

## Fontes obrigatórias

1. `AGENTS.md`.
2. `skills/zoom-integration/SKILL.md`.
3. `docs/zoom/*.md`.
4. `docs/product/sitemap.md`.
5. `docs/product/routes-map.md`.
6. `docs/design-system/design-system.md`.
7. `src/lib/routes.ts`.

Frame dedicado no Figma: Não identificado nos arquivos analisados.

## Rotas

- Paciente: `/app/encontros/:bookingId/video`.
- Terapeuta: `/terapeuta/sessoes/:bookingId/video`.
- A saída segura retorna ao detalhe canônico do mesmo booking.
- As duas rotas removem sidebar e topbar, sem alterar autenticação ou
  autorização.

## Componentes e dados

- Reutilizar `ZoomVideoCallPage` para a estrutura imersiva.
- Reutilizar `ZoomVideoSessionAdapter` para preflight, espera, entrada,
  controles, reconexão e encerramento.
- Paciente e terapeuta devem consultar os read models já existentes antes de
  renderizar a sala.
- A autorização definitiva continua em `/api/zoom/video-session-access`.
- Não criar fallback demonstrativo nem dados locais para preencher a sala.

## Segurança e copy

- Nunca persistir ou exibir JWT, secret, session name ou user key.
- Nunca confiar em booking, papel ou horário fornecidos pelo navegador.
- Usar “encontro” para paciente e “sessão” para terapeuta.
- Não exibir nomes de stack, backend, webhook, token, tabela ou mensagem de
  desenvolvimento na interface.

## QA

- Confirmar que o CTA do detalhe abre a sala do mesmo booking.
- Confirmar que a sala não exibe sidebar nem topbar.
- Confirmar retorno ao detalhe e foco visível.
- Validar waiting room, preflight, áudio, vídeo, reconexão, saída e
  encerramento conforme o papel.
- Validar desktop e mobile com controles de pelo menos 44px.
- Executar testes focados, `npm run typecheck`, `npm run lint` e
  `npm run build`.
- Homologações reais devem usar Playwright headed, contexts isolados, Zoom real
  e confirmação final no Supabase.

## Pendências conhecidas

- Criar ou vincular um frame Figma específico para a sala dedicada.
