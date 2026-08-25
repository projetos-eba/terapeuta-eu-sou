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

Frame dedicado no Figma: Não identificado nos arquivos analisados. O detalhe do
encontro usa o nó Figma `13366:6713`; as referências visuais da sala foram
fornecidas em 2026-08-24 e as capas locais aprovadas são:

- `public/zoom/waiting-room-cover.png` para a sala de espera;
- `public/zoom/local-camera-off-cover.png` para a câmera local desativada;
- `public/zoom/remote-waiting-cover.png` para a espera do outro participante.

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
- O cabeçalho da sala e o cartão da sala de espera exibem o ID completo da
  reserva logo abaixo do participante. A referência é o `bookingId` já
  autorizado pela rota e não é um identificador do provedor Zoom.
- A apresentação fica separada da integração: `ZoomVideoStage` concentra a
  composição desktop/mobile e `ZoomVideoControls` concentra preflight,
  microfone, câmera, suporte e saída. O adapter continua sendo a autoridade
  de lifecycle do Video SDK.
- Ao sair ou encerrar, o adapter muda para o feedback na mesma rota. O detalhe
  pode reabrir a experiência por `?feedback=1`; não criar rota canônica nova.
- Antes de T-15, renderizar somente preparação e horário de abertura. Em T-15,
  renderizar sala visual de espera com capa abstrata, contador, preflight e
  estado host-first; nunca liberar JWT do paciente apenas por query string.
- A primeira entrada do paciente termina em T+15, inclusive. Depois disso,
  somente uma participação confiável anterior permite reconexão, sempre antes
  de `scheduled_ends_at`. Terapeuta e reconexão autorizada terminam exatamente
  no fim agendado.
- O contador visível usa somente `scheduledStartsAt`, `scheduledEndsAt` e
  `serverNow`. `hardEndsAt` é watchdog interno e nunca representa duração do
  encontro.
- A prévia de câmera é local ao navegador e usa `getUserMedia({ video: true,
  audio: false })`; o teste de áudio usa somente `getUserMedia({ audio: true,
  video: false })` e um indicador local de nível. Ambos encerram tracks ao
  desligar o teste, entrar, falhar ou desmontar a tela.
- A qualidade do encontro só fica elegível após `session.user_joined` confiável
  para paciente e terapeuta e encerramento efetivo/programado. Um único join
  direciona para ocorrência, não para avaliação de qualidade.
- Música é opcional, sem autoplay e sem asset fictício; sem fonte licenciada,
  manter o card visual com play inativo. A interface opcional `ambientAudioSrc`
  só toca após gesto explícito do usuário.
- O feedback bilateral usa `skills/session-feedback`, é privado, independente
  de `reviews` públicos e também aparece somente como leitura no detalhe Admin.
- Paciente e terapeuta devem consultar os read models já existentes antes de
  renderizar a sala.
- A autorização definitiva continua em `/api/zoom/video-session-access`.
- Não criar fallback demonstrativo nem dados locais para preencher a sala.

## Segurança e copy

- Nunca persistir ou exibir JWT, secret, session name ou user key.
- Nunca confiar em booking, papel ou horário fornecidos pelo navegador.
- Usar “encontro” para paciente e “sessão” para terapeuta.
- A confirmação de encerramento usa `TESDialog`; não usar confirmação nativa do
  navegador.
- Não exibir nomes de stack, backend, webhook, token, tabela ou mensagem de
  desenvolvimento na interface.

## QA

- Confirmar que o CTA do detalhe abre a sala do mesmo booking e continua
  acessível durante a janela ativa mesmo sem presença do terapeuta; o bloqueio
  host-first ocorre dentro da sala, antes da emissão de JWT do paciente.
- Confirmar que a sala não exibe sidebar nem topbar.
- Confirmar retorno ao detalhe e foco visível.
- Validar waiting room, preflight, áudio, vídeo, reconexão, saída e
  encerramento conforme o papel.
- Validar bloqueio antes de T-15, espera com terapeuta ausente, liberação do
  paciente após join do terapeuta, ambos os joins, saída e estados de ocorrência.
- Validar a transição `leave -> feedback`, feedback já enviado, erro de leitura,
  erro de envio, resposta realizada, não realização, comentário de 500
  caracteres e reabertura por query controlada.
- O `userId` local vem de `ZoomVideoClient.getCurrentUserInfo()`, nunca do
  media stream. A self-view e os vídeos remotos usam `attachVideo` dentro de
  `video-player-container`; `renderVideo` em canvas não é o contrato
  preferencial.
- Inicializar o SDK com `enforceMultipleVideos: true`. Separar presença do
  participante do estado do vídeo remoto (`off`, `attaching`, `on`, `error`) e
  ressincronizar após join, atualização, câmera do peer e reconexão. Em limite
  de render, priorizar o remoto e informar que a prévia local está indisponível.
- Tratar `user-added` e `user-updated` como deltas de participantes. Nunca usar
  a ausência de um usuário nesses payloads para removê-lo, nem converter
  `bVideoOn` ausente em câmera desligada; a reconciliação completa usa somente
  `getAllUser()` após join e reconexão.
- Ícones comunicam o estado atual: `MicOff`/`VideoOff` desligado e
  `Mic`/`Video` ligado; o nome acessível descreve a próxima ação.
- Validar câmera inicialmente desligada, ativação após o join, desligamento e
  visualização bidirecional real. Exercitar também permissão negada, nova
  concessão e recuperação sem recriar booking ou relaxar autorização.
- Validar que as capas aparecem até o vídeo correspondente, que a prévia local
  substitui apenas a capa de espera, que câmera e microfone são pedidos de modo
  independente e que nenhum track permanece ativo após a navegação.
- Em mobile a chamada deve caber em `100dvh` com fallback de viewport, vídeo
  remoto dominante, self-view contida e controles essenciais visíveis. Não
  usar as antigas alturas mínimas cumulativas por participante.
- Validar desktop, tablet, mobile de aproximadamente 390px e mobile baixo, com
  controles de pelo menos 44px, sem overflow da página.
- Aceite HML móvel exige Safari/iPhone e Chrome/Android reais; viewport Chromium
  é evidência responsiva complementar, não substituto.
- Executar testes focados, `npm run typecheck`, `npm run lint` e
  `npm run build`.
- Executar `npm run test:deno`, `npm run zoom:video-sdk:test`, `npx supabase
  db reset`, `npx supabase db lint --schema public` e `npx supabase test db`
  quando o ambiente local estiver disponível.
- Homologações reais devem usar Playwright headed, contexts isolados, Zoom real
  e confirmação final no Supabase.

## Pendências conhecidas

- Criar ou vincular um frame Figma específico para a sala dedicada.
