---
name: zoom-video-call
description: Implementar e validar as salas dedicadas de videochamada Zoom para paciente e terapeuta no TES.
---

# Sala dedicada de videochamada

## Ativação mobile

No mobile, a câmera selecionada no preflight é uma intenção transitória. A sala
ativa mantém somente os controles por ícone; o ícone da câmera publica no clique
e deve chamar `startVideo()` sem `await` anterior. O container “Você”, eventos
de captura e reconexões recuperam o self-view automaticamente. Permissão negada
deve orientar a revisão nas configurações do navegador, sem loop automático.
Uma página web não consegue revogar a permissão persistida do iOS ou Android.

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
  autorizado pela rota e não é um identificador do provedor Zoom. No cartão
  responsivo, o ID nunca pode extrapolar o container: truncar com reticências
  e permitir revelar o valor completo por foco, hover ou toque.
- A apresentação fica separada da integração: `ZoomVideoStage` concentra a
  composição desktop/mobile e `ZoomVideoControls` concentra preflight,
  microfone, câmera, suporte e saída. O adapter continua sendo a autoridade
  de lifecycle do Video SDK.
- Sair é individual: usa `leave(false)`, volta à espera e preserva reconexão.
  O controle de saída permanece acionável mesmo quando a conexão caiu, para
  que a mídia local possa ser limpa; a operação remota pode ser concluída na
  próxima reconexão. Uma chegada pontual ou participação confiável persistida
  preserva a autorização de reentrada até o fim agendado, desde que a presença
  atual do terapeuta continue válida. Somente encerramento definitivo
  confirmado pelo backend, ou fim programado, libera feedback na mesma rota. O
  detalhe pode reabrir a experiência por `?feedback=1`; não criar rota
  canônica nova.
- Se `session.ended` chegar antes do fim agendado sem uma solicitação de
  encerramento autorizada, tratar como término da instância remota, não da
  sessão lógica: manter reentrada e limpar a referência remota. A grace de 120s
  não encerra o encontro; um novo join deve aceitar o novo identificador remoto
  da mesma sala lógica. Somente fim manual autorizado, fim agendado ou hard
  timeout são terminais.
- Antes de T-15, renderizar somente preparação e horário de abertura. Em T-15,
  renderizar sala visual de espera com capa abstrata, contador, preflight e
  estado host-first; nunca liberar JWT do paciente apenas por query string.
- A chegada do paciente é registrada ao abrir a espera autenticada entre T-15 e
  T+10, inclusive, por booking e versão. Essa chegada ou uma participação
  confiável anterior permite reconexão de ambos antes de `scheduled_ends_at`;
  cada join do paciente ainda exige presença atual do terapeuta. Em T+10+1 ms,
  os dois papéis são bloqueados somente se não houver nenhuma dessas evidências.
  Atraso, saída e reconexão do terapeuta nunca equivalem a ausência do paciente.
- Somente terapeuta encerra para todos, pelo backend, entre T-5 inclusive e o
  fim agendado. Antes disso o controle fica desabilitado. Nunca chamar
  `client.leave(true)` no navegador.
- O contador visível usa somente `scheduledStartsAt`, `scheduledEndsAt` e
  `serverNow`. `hardEndsAt` é watchdog interno e nunca representa duração do
  encontro.
- Na sala de espera, a contagem regressiva até o início permanece visível. Na
  sala de vídeo ativa, não exibir contagem antes do horário agendado; depois do
  início, exibir somente o tempo restante até o fim da sessão/encontro.
- A prévia de câmera é local ao navegador e usa `getUserMedia({ video: true,
audio: false })`; o teste de áudio usa somente `getUserMedia({ audio: true,
video: false })` e um indicador local de nível. Ambos encerram tracks ao
  desligar o teste, entrar, falhar ou desmontar a tela. Ao clicar para entrar,
  a sala de espera envia ao adapter as duas preferências atuais: cada mídia
  testada e ligada é ativada após o `join`; qualquer mídia não ligada continua
  desligada. Essa preferência é transitória no navegador e não é persistida.
- Captura e prévia própria têm estados independentes: `videoOn` reflete
  publicação; `localPreviewUnavailable` reflete falha de exibição. Não chamar
  `stopVideo` nem informar permissão negada porque `attachVideo` falhou.
  O SDK 2.4.5 resolve `startVideo` com `undefined`; preservar o normalizador
  específico e os testes com esse retorno. Cleanup espera captura/attach
  pendentes; desligar câmera para a publicação antes do detach.
- Prévia deve recuperar também identidade `null → userId`, não só mudança
  entre dois IDs. Preservar reconciliação idempotente por geração e retries
  automáticos limitados, sem botão ou link textual e sem repetir captura/JWT.
  Após `startVideo`, `bVideoOn` atrasado é apenas diagnóstico. Falha de
  detach ativo é diagnóstico de renderização, nunca aviso de encerramento.
  Em reentrada abrupta, `video-capturing-change: Started` reabre o orçamento de
  attach do ciclo de captura atual, inclusive se chega durante uma operação
  pendente. Retorno à visibilidade reconcilia somente a prévia; `pagehide`
  continua limpando a mídia. Consultar
  `docs/zoom/patient-preview-recovery-2026-08-28.md` e
  `docs/zoom/abrupt-reentry-self-view-2026-08-28.md` e
  `docs/zoom/mobile-self-view-binding-2026-08-28.md`.
- No mobile, manter um único `video-player-container` local persistente e anexar
  nele o player devolvido por `attachVideo(userId, quality)`. A montagem tardia
  do container reconcilia o attach sem interação. Depois de `startVideo` e da
  identidade local autoritativa, chamar `attachVideo` mesmo se `bVideoOn` ainda
  estiver falso; não usar esse campo como pré-requisito. Timeout desanexa
  exatamente o player retornado e permite retry sem nova captura, join ou JWT. Observer, timer e Promise
  pertencem a `generation + client + stream + captureEpoch + localUserId`. Se o
  vínculo do player persistente expirar no Safari móvel, uma única tentativa
  complementar usa o player criado pelo próprio SDK no mesmo container; ela
  também exige `node-id` e é desanexada integralmente em caso de falha.
- Antes de alterar integração ou mocks, ler
  `docs/zoom/investigation-2026-08-27.md` e
  `docs/zoom/self-view-2026-08-27.md` e
  `docs/zoom/camera-routing-2026-08-28.md`: contêm causas comprovadas e
  invariantes para não reintroduzir falhas de join, destroy, self-view e
  roteamento entre os quadros.
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
- Confirmar que a mensagem “O terapeuta iniciou o encontro” aparece somente
  para paciente quando a entrada é liberada; terapeuta não recebe essa copy.
- Validar `leave -> espera -> reentrada`, inclusive com a saída disponível sem
  conexão, `final end -> feedback`, feedback já enviado, erro de leitura,
  erro de envio, resposta realizada, não realização, comentário de 500
  caracteres e reabertura por query controlada.
- Validar o retorno participante de `join` no SDK instalado, além de `""`.
  Erro resolvido ou rejeitado de áudio após join mantém `media_degraded`, sem
  sair da sessão. Distinguir `joining`, `joined`, `media_initializing`,
  `media_degraded` e `disconnected` nos testes.
- Chamar `ZoomVideo.destroyClient()` preservando o receiver. Uma falha ou
  timeout de destroy invalida o singleton até recarga; não tentar reutilizá-lo
  nem emitir outro JWT. Retry de sessão exige cleanup concluído, client novo
  e o mesmo acesso; reconexão nativa bem-sucedida preserva o client existente.
- Atualizar access em cada dispositivo na espera, inclusive após a liberação;
  resposta tardia de preview não substitui estado/mensagem da chamada.
- O `userId`/`userKey` local vem primeiro do participante retornado por
  `join()`; `getCurrentUserInfo()` é fallback e renovação em `Connected`, nunca
  o media stream. Sem identidade local autoritativa, bloquear attach remoto. A
  self-view e os vídeos remotos usam `attachVideo` dentro de
  `video-player-container`; `renderVideo` em canvas não é o contrato
  preferencial.
- Inicializar o SDK com `enforceMultipleVideos: true`. Separar presença do
  participante do estado do vídeo remoto (`off`, `attaching`, `on`, `error`) e
  ressincronizar após join, atualização, câmera do peer e reconexão. Em limite
  de render, priorizar o remoto e informar que a prévia local está indisponível.
- Tratar eventos de usuário e vídeo como deltas/gatilhos, nunca como roster. A
  reconciliação completa usa somente `getAllUser()`. Excluir IDs com o mesmo
  `userKey` local, selecionar apenas uma instância estável da contraparte e
  falhar fechado diante de identidades remotas conflitantes.
- Vincular timers e operações de vídeo a `generation + client + stream`,
  revalidar ownership após cada `await` e desanexar pelo par
  `detachVideo(userId, element)`. Cada container tem no máximo um player e um
  elemento nunca muda do self-view para o remoto, nem no sentido inverso.
- Validar separadamente publicação, `bVideoOn`, criação do player e vínculo por
  `node-id`. Cobrir retorno imediato de `attachVideo` com vínculo tardio,
  timeout e callback antigo após cleanup em Chromium e WebKit mobile.
- Ícones comunicam o estado atual: `MicOff`/`VideoOff` desligado e
  `Mic`/`Video` ligado; o nome acessível descreve a próxima ação.
- Validar câmera inicialmente desligada, ativação após o join, desligamento e
  visualização bidirecional real. Exercitar também permissão negada, nova
  concessão e recuperação sem recriar booking ou relaxar autorização.
- Validar processo móvel descartado sem `leave/pagehide`, novo `userId` com o
  mesmo `userKey`, instância antiga ainda no roster, remoto anexado primeiro e
  `video-capturing-change: Started` tardio. A recuperação não repete
  `startVideo`, join nem JWT.
- Validar para paciente e terapeuta que câmera e microfone ligados na sala de
  espera entram ligados na sala ativa e que, sem teste habilitado, ambos entram
  desligados/silenciados.
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
