# Troubleshooting Zoom Video SDK

## Outro participante vê minha câmera, mas eu não me vejo

Não concluir que é permissão negada: se o outro participante recebe imagem,
a captura está funcionando. No SDK 2.4.5, `startVideo()` resolve `undefined`;
validar somente `""` fabrica erro 2 e impede o `attachVideo` local. Usar o
normalizador específico de captura, sem relaxar contratos de init/áudio.
Ver [causa, regressões e continuidade da espera](./self-view-2026-08-27.md).
Falha real de attach deve mostrar câmera ligada sem prévia, não câmera
desligada. A prévia é reconciliada quando a identidade fica disponível, por
timers/eventos e reconexão, com até três tentativas de attach. “Tentar mostrar
minha câmera” repete apenas a exibição, sem desligar publicação nem refazer join.
Ver [identidade tardia e recuperação](./patient-preview-recovery-2026-08-28.md).

Se isso ocorre somente depois que o aparelho fecha ou desliga abruptamente,
verifique `operation=video.attach.local`, `captureState`, `captureEpoch` e
`localPreviewTrigger` no log sanitizado. O evento
`video-capturing-change: Started` deve reabrir as tentativas do ciclo atual,
inclusive quando chega depois de 1.200 ms ou durante um attach pendente. A
instância antiga com o mesmo `userKey` não pode ser escolhida como remoto. Ver
[self-view após reentrada abrupta](./abrupt-reentry-self-view-2026-08-28.md).

Se a falha for exclusiva do mobile e o remoto receber a câmera local, separar
quatro fatos: captura iniciada, vídeo publicado, roster (`bVideoOn`) e player
vinculado (`node-id=localUserId`). Um `<video-player>` apenas conectado ao DOM
não comprova vínculo. Procurar os códigos sanitizados
`LOCAL_RENDER_ROSTER_LAG`, `LOCAL_RENDER_BOUND` e `LOCAL_RENDER_TIMEOUT`.
Após `startVideo`, roster local atrasado não pode bloquear `attachVideo` do
participante atual; `TIMEOUT` deve desanexar somente o player local e preservar
publicação e vídeo remoto. Ver
[vinculação tardia da prévia mobile](./mobile-self-view-binding-2026-08-28.md).

Se o defeito ocorrer apenas quando câmera ou microfone já foram testados na
sala de espera, verificar também a ordem React: o `<video-player>` local deve
estar montado antes de iniciar a captura pré-ativada. A montagem tardia deve
refazer somente o attach local; não depender de novo prompt de permissão nem
de clique em microfone/câmera.

Quando o usuário aciona a recuperação manual enquanto a câmera já foi publicada,
o adapter refaz somente o vínculo da self-view. O roster pode ser relido como
diagnóstico, mas não bloqueia o attach nem repete captura, `join` ou emissão de
JWT. Os timers são cancelados ao desligar a câmera, sair ou desmontar a sala.

Se o `node-id` do player persistente expirar no Safari mobile, o adapter faz uma
única tentativa complementar com um `video-player` criado pelo próprio SDK no
mesmo container. Essa rota reutiliza a captura e a sessão ativas, exige o mesmo
vínculo de participante e desanexa o elemento se o vínculo não for confirmado.

## Aviso de encerramento durante uma chamada conectada

Não interpretar esse aviso isolado como desconexão. A versão anterior misturava
falhas de detach de renderização ativa com falhas de saída. Agora
`ZOOM_VIDEO_RENDER_CLEANUP_PARTIAL_FAILURE` é diagnóstico de renderização;
`ZOOM_VIDEO_CLEANUP_PARTIAL_FAILURE` pertence à saída. O aviso visual de
encerramento fica restrito à saída/erro de recuperação, nunca a um detach de
reconciliação ativa. Conferir operação sanitizada e estado da conexão antes de
atribuir o problema a join, permissão ou backend.

## Entrada falha com código 2, cleanup parcial e depois 5012

Consultar a [investigação anterior](./investigation-2026-08-27.md) antes de
mudar retries ou lifecycle. O bundle pode resolver `join` com participante,
e `ZoomVideo.destroyClient()` depende do receiver. Não extrair esse método,
reutilizar singleton cujo destroy falhou ou emitir novos JWTs para resolver
erro de mídia. Áudio pós-join não invalida uma conexão já estabelecida.
Fim técnico `session.ended` não é automaticamente fim lógico do encontro.

## Sala encerrada após todos saírem antes do fim agendado

Ausência do terapeuta por 120 segundos e `session.ended` do Zoom são sinais
técnicos, não autorização para encerrar o encontro TES. Durante a janela
T-15 até `scheduled_ends_at` exclusivo, o terapeuta que chegou ou entrou até
T+10 continua elegível para reentrar. Quem não compareceu nesse prazo não
ganha acesso tardio pela chegada do cliente. O paciente previamente legitimado
permanece host-first: recebe
`THERAPIST_NOT_IN_SESSION` enquanto o terapeuta está fora e volta a ser
liberado depois de um novo `session.user_joined` confiável do host.

Se a sessão ficar `ended` com `termination_reason=therapist_absent` ou
`reconcile_orphan`, comparar `termination_confirmed_at` com
`scheduled_ends_at` e a fila de maintenance. Isso indica o lifecycle legado;
não reparar dados manualmente e não reabrir sessões já confirmadas. Corrigir por
migration versionada e validar localmente conforme
[lifecycle de reentrada](./reentry-lifecycle-2026-08-28.md).

## Cliente aguardou, mas o terapeuta não compareceu até T+10

Confira a versão e os horários da reserva, os eventos autenticados
`zoom_waiting_room_entered` por papel e os `session.user_joined` confiáveis.
T+10 exato é permitido; em T+10 ultrapassado, a entrada tardia do terapeuta
deve ser negada mesmo que o cliente tenha chegado. O cliente deve ver
“Encontro não realizado”, e a reserva deve ficar `no_show_therapist`, com
incidente aberto e pagamento bloqueado para análise do Admin. Não peça ao
terapeuta para confirmar um atendimento sem entrada bilateral.

Se a reserva continuar `confirmed`, verifique a execução do finalizador e se
há sessões antigas normais consumindo o limite da fila. Um trabalho
`end_attendance_no_show` fecha a sala lógica: confirme a versão do agendamento
e o estado do job. Com ID do provedor persistido, encerre somente esse ID;
sem ID, aceite apenas uma sessão ativa de nome **exatamente** igual. Duplicatas
ou erro do provedor exigem revisão, sem encerramento manual por nome parcial.
Nunca faça Refund, Transfer Reversal, nova tentativa de Transfer ou
reagendamento automaticamente durante a classificação. O Admin decide entre
reagendamento e reembolso com justificativa; registre o desfecho no incidente.

## O teste real foi bloqueado antes de abrir a sessao

Isso e esperado quando qualquer gate estiver incompleto. Corrija apenas o item
listado e rode de novo. O comando nao cria fixtures nem abre browser sem:

- `ALLOW_REAL_ZOOM=true`;
- `ZOOM_ENVIRONMENT=development`;
- Supabase local ou staging autorizado;
- URL ngrok ativa;
- webhook verificado e nao expirado para a URL atual;
- pagamento Stripe test confirmado por webhook canonico quando o objetivo for
  homologacao transacional completa;
- nenhuma sessao ativa;
- flags `--confirm-zoom-marketplace --confirm-single-real-session`.

## O webhook expirou

Rode novamente:

```bash
npm run zoom:video-sdk:webhook:real-verify
```

A confirmacao dura pouco e fica vinculada a URL ngrok atual. Nova URL exige nova
validacao manual no Zoom e novo `real-verify`.

## O Marketplace mostra `URL validation failed. Try again later`

Esse erro pode ocorrer mesmo com HTTP 200 quando o corpo do
`endpoint.url_validation` nao esta no formato exato esperado pelo Zoom. A
resposta deve ser o JSON raiz:

```json
{
  "plainToken": "<plainToken recebido>",
  "encryptedToken": "<hmac sha256 do plainToken com o Secret Token>"
}
```

Nao use o envelope padrao da API TES, como `{ "ok": true, "data": ... }`, para
esse evento. Antes de clicar em **Validate** no Marketplace, rode:

```bash
npm run zoom:video-sdk:webhook:real-preflight
```

O resultado precisa indicar `validationShape: true`.

Se o terapeuta consegue entrar no Video SDK, mas a fase
`therapist_presence_webhook` termina em `poll_timeout`, a URL publica pode estar
respondendo ao preflight sem estar ativa na assinatura do Zoom. Mantenha
`npm run zoom:video-sdk:webhook:tunnel` em execução, confira no Marketplace a
mesma URL atual e os quatro eventos selecionados, clique em **Validate** e
salve a assinatura. O `real-verify` local confirma apenas alcance e formato;
ele não ativa nem altera a configuração do Marketplace.

Durante a homologação local, `scripts/start-local-functions.ps1` isola
temporariamente `supabase/functions/.env` enquanto o watcher das Edge
Functions está ativo. Isso evita que a alteração do arquivo seja interpretada
como entrypoint pelo Supabase CLI; o arquivo é restaurado ao encerrar o
processo.

Atualização operacional: o arquivo `supabase/functions/.env` deve permanecer
no caminho original durante todo o processo. O webhook, o túnel e as Edge
Functions compartilham essa configuração; nenhuma etapa deve renomeá-lo.

## Existe sessao ativa antes do teste

Nao rode o teste real. Primeiro identifique e encerre a sessao pelo host ou pela
rotina operacional:

```bash
npm run zoom:video-sdk:emergency-end
npm run zoom:video-sdk:real-preflight
```

Se o estado temporario nao tiver `provider_session_id`, mas o preflight mostrar
exatamente uma sessao ativa, use:

```bash
npm run zoom:video-sdk:emergency-end -- --active-singleton
```

Se houver mais de uma sessao ativa, encerre manualmente no Zoom Build
Platform/API usando o procedimento oficial e repita o preflight.

## Cleanup nao foi comprovado

Pare novos testes. O script imprime IDs sanitizados e um procedimento manual.
Remova somente os registros temporarios marcados pelo `runId`, respeitando esta
ordem: participacoes, webhooks, video session, ledger, pagamentos, booking,
disponibilidade, servico, assinatura, perfis e Auth users. Depois rode as
consultas de prova indicadas no erro antes de tentar novamente.

## Rate limit de acesso bloqueou a entrada

O limite e intencional e distribuido no banco. Ele impede emissao repetida de
JWTs por booking/perfil/papel dentro de uma janela curta. Aguarde a janela
expirar ou investigue chamadas duplicadas no cliente antes de repetir.

## O participante entrou, mas o video remoto nao apareceu

Confirme separadamente presenca e renderizacao. `session.user_joined` prova que
a pessoa entrou, mas nao prova que o elemento remoto foi anexado. Verifique se
o cliente foi inicializado com `enforceMultipleVideos: true`, se cada tile usa
um `video-player-container` independente e se a camera remota percorreu
`off -> attaching -> on`. Em `error`, use a recuperacao visivel; o adapter faz
tentativas limitadas apos join, eventos de usuario/video e reconexao. Em
dispositivo limitado a um render, o video remoto tem prioridade.

Se o remoto desaparece exatamente quando a camera local e ligada, confirme que
os eventos de usuário/vídeo estão sendo tratados apenas como gatilhos. Esses
eventos podem conter somente o participante alterado; usar o payload como
roster completo faz a aplicação desconectar incorretamente os remotos ausentes
do evento. Somente `getAllUser()` alimenta a reconciliação completa, e a
ausência de `bVideoOn` em uma atualização não significa câmera desligada.

Se a câmera local aparece no quadro nomeado como remoto, confirme que a
identidade retornada por `join()` foi armazenada antes da mídia e que nenhum
attach remoto ocorre enquanto o `userId` local estiver indeterminado. Um
segundo dispositivo com o mesmo `userKey` local deve ser excluído. Em uma sala
1:1, duas identidades remotas distintas são ambíguas e devem falhar fechado;
duas instâncias da mesma contraparte produzem somente um player estável.
Ver [incidente de roteamento de câmera](./camera-routing-2026-08-28.md).

## O contador mostra a duracao errada

Inspecione `scheduled_starts_at`, `scheduled_ends_at` e `serverNow`. A interface
nunca deve usar `hard_ends_at`: esse campo e o watchdog interno calculado a
partir do inicio efetivo mais a configuracao (240 minutos em HML). Um valor de
watchdog incoerente exige auditoria de migration, funcao implantada e eventos,
mas nao pode aparecer como "Tempo restante do encontro".

## O paciente saiu e recebeu 409 ao tentar voltar

Na regra local da ADR-023, consulte `booking_session_attempts`, o payload da
chegada autenticada com `sessionAttemptId`, a participação vinculada à mesma
tentativa e o limite T+10 inclusivo. Uma participação antiga nunca dá direito
de reentrada nem comprova sessão realizada. Após ausência classificada, a
entrada fica bloqueada mesmo se o Zoom ainda estiver terminando a sala.
Verifique os jobs por status e `next_run_at`; retry e dead letter não devem
ser adiantados por um novo scan. Escale dead letter ao Admin, sem encerrar
nomes parecidos ou presumir resultado financeiro. Relatos de qualidade têm
ticket privado e prazo de resposta TES de cinco dias; somente resposta
pública no ticket correto encerra a análise, sem alterar Transfer.

Confira a razão sanitizada retornada pelo acesso. `THERAPIST_NOT_IN_SESSION`
significa que a chegada pode continuar válida, mas o terapeuta precisa estar
presente novamente. `TOO_LATE` só deve ocorrer antes do primeiro acesso quando
não existe `zoom_waiting_room_entered` da versão atual nem
`session.user_joined` confiável, ou quando o horário programado terminou.
Verifique booking `version`, `starts_at`, o evento de chegada e a presença do
terapeuta sem inspecionar ou expor identificadores do provedor.

## Sair abriu feedback ou Encerrar para todos apareceu cedo

`Sair do encontro/sessão` é sempre individual e recuperável; deve usar
`leave(false)` e voltar à espera. `Encerrar para todos` é exclusivo do
terapeuta, permanece desabilitado antes de T-5 e passa pelo intent backend
`end`. Um evento `Closed` precoce não basta para liberar feedback: confirme o
estado de attendance server-side e aguarde o fim agendado quando o provedor
encerrou antes da janela final.

## O orquestrador parou em `canonical_stripe_payment_e2e_pending`

Nao abra Zoom por fora. Esse bloqueio significa que ainda nao existe evidencia
de Checkout Stripe test, webhook assinado processado, pagamento `paid` e
`video_session` canonica para a booking. O harness tecnico com pagamento direto
so valida Zoom isoladamente e deve ser executado apenas com a flag diagnostica
documentada.
