# Troubleshooting Zoom Video SDK

## Outro participante vê minha câmera, mas eu não me vejo

Não concluir que é permissão negada: se o outro participante recebe imagem,
a captura está funcionando. No SDK 2.4.5, `startVideo()` resolve `undefined`;
validar somente `""` fabrica erro 2 e impede o `attachVideo` local. Usar o
normalizador específico de captura, sem relaxar contratos de init/áudio.
Ver [causa, regressões e continuidade da espera](./self-view-2026-08-27.md).
Falha real de attach deve mostrar câmera ligada sem prévia, não câmera
desligada; desligar/ligar a câmera permite repetir a exibição local.

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
T-15 até `scheduled_ends_at` exclusivo, o terapeuta continua elegível para
reentrar. O paciente previamente legitimado permanece host-first: recebe
`THERAPIST_NOT_IN_SESSION` enquanto o terapeuta está fora e volta a ser
liberado depois de um novo `session.user_joined` confiável do host.

Se a sessão ficar `ended` com `termination_reason=therapist_absent` ou
`reconcile_orphan`, comparar `termination_confirmed_at` com
`scheduled_ends_at` e a fila de maintenance. Isso indica o lifecycle legado;
não reparar dados manualmente e não reabrir sessões já confirmadas. Corrigir por
migration versionada e validar localmente conforme
[lifecycle de reentrada](./reentry-lifecycle-2026-08-28.md).

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
