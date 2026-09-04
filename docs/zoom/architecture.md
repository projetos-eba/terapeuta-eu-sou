# Arquitetura Zoom Video SDK

O TES usa Zoom Video SDK como provedor operacional de audio e video dentro do
site. Pagamento, elegibilidade financeira, repasse e confirmacao de servico
continuam sob Stripe, `session_payments`, ledger e regras internas.

## Fluxo

### Mobile camera activation

On mobile browsers, the waiting-room camera choice is retained as a transient
intent. The active room shows "Ativar minha camera" after its renderer mounts,
and the click calls `startVideo()` directly in the user gesture. If capture is
already published, recovery only reattaches self-view; the browser permission
is never revoked programmatically and reconnect does not force `stop/start`.

1. Stripe confirma `session_payments.financial_status = paid`.
2. O backend cria ou atualiza uma `video_sessions` local para a booking.
3. Nenhuma chamada ao Zoom e feita nessa etapa.
4. Paciente ou terapeuta solicita acesso por `/api/zoom/video-session-access`.
5. A Edge Function `zoom-video-session-access` autentica, valida ownership,
   pagamento, status, janela e perfil.
6. Para paciente, o backend exige presenca confiavel do terapeuta registrada por
   webhook `session.user_joined`; preview nao emite JWT nem consome rate limit.
7. O backend calcula `role_type`: paciente `0`, terapeuta responsavel `1`.
8. O backend gera JWT curto do Video SDK e devolve somente `sdkKey`,
   `sessionName`, `token`, `userName`, `roleType` e passcode nulo.
9. O browser inicializa `@zoom/videosdk` e entra na sessao.
10. A sessao Zoom comeca quando o primeiro usuario autorizado entra.
11. Webhooks `session.*` atualizam inicio, fim, presenca e participacoes
    operacionais.

Antes do horario de abertura, a rota mostra somente a preparação do encontro e
o horário de liberação. A sala visual é liberada em T-15. O terapeuta mantém o
modelo host-first: entra primeiro e o paciente permanece aguardando até que o
webhook confiável `session.user_joined` confirme a presença do terapeuta. O
preflight não é presença e não libera feedback de qualidade.

Enquanto a sala estiver aberta ou reconectando, o browser solicita a renovação
da sessão TES em `POST /api/auth/session/refresh`. O endpoint lê somente
cookies HTTP-only, rotaciona o refresh token apenas nos últimos 15 minutos do
access token e revalida o papel em `profiles`. Falha momentânea dessa renovação
não encerra a mídia local; a próxima tentativa ou a reconexão volta a verificar
o acesso. A renovação do login TES não altera a duração da sessão Zoom nem a
validade do JWT curto emitido para o `join`.

O proxy Next envia `actorRole` e seleciona explicitamente o cookie desse papel.
A Edge Function rejeita mismatch para impedir token cruzado entre paciente e
terapeuta.

## Apresentação da sala e pós-sessão

`ZoomVideoSessionAdapter` mantém o lifecycle do Video SDK separado da
apresentação. `ZoomVideoStage` compõe os vídeos local/remoto, identificação,
câmera e conexão em desktop e mobile; `ZoomVideoControls` concentra preflight,
áudio, vídeo, suporte e saída. Em mobile, o remoto é dominante, o self-view é
contido e o dock respeita `100dvh`.

O participante devolvido por `join()` é a primeira identidade local
autoritativa. `getCurrentUserInfo()` é fallback e fonte de renovação em
`connection-change: Connected`; enquanto nenhuma dessas fontes fornecer
`userId` válido, o adapter não anexa remoto. O `userKey` determinístico agrupa
conexões da mesma pessoa e impede que um segundo dispositivo local seja
classificado como contraparte.

Os eventos `user-added`, `user-removed`, `user-updated` e
`peer-video-state-change` são deltas e apenas disparam reconciliação. O roster
autoritativo vem de `getAllUser()`. Como a sala é 1:1, o adapter seleciona uma
única identidade remota e um único player estável; instâncias duplicadas do
mesmo `userKey` não são empilhadas, e identidades remotas conflitantes falham
fechado. Ver [incidente de roteamento de câmera](./camera-routing-2026-08-28.md).

Publicação e prévia local têm recuperação independente. Identidade tardia
(`null → userId`), timers de roster e `Connected` reconciliam o self-view
sem repetir captura ou join. O attach local é idempotente por geração e sua
Promise integra o cleanup; retries são limitados, com recuperação explícita
sem novo JWT. Falhas de renderização ativa não alimentam o aviso de teardown.
Em reentrada móvel fria, `video-capturing-change: Started` reabre o orçamento
de attach do ciclo atual; o sinal pode chegar depois das tentativas provisórias
sem repetir publicação. O retorno à visibilidade também reconcilia a prévia
pelo mesmo ownership; `pagehide` continua limpando a mídia por privacidade. Ver
[recuperação da prévia do paciente](./patient-preview-recovery-2026-08-28.md) e
[reentrada abrupta](./abrupt-reentry-self-view-2026-08-28.md).

Antes do join, a sala de espera pode abrir uma prévia exclusivamente local no
navegador: o teste de câmera solicita somente vídeo e substitui a capa visual;
o teste de áudio solicita somente microfone e mostra um indicador local. Esses
streams não inicializam o Video SDK, não solicitam acesso à sala, não emitem
JWT e são encerrados ao desligar o teste, entrar, falhar ou desmontar a tela.
No clique de entrada, a sala envia ao adapter um snapshot das preferências de
câmera e microfone. Depois do `join`, o adapter ativa apenas as mídias que
estavam ligadas nesse snapshot; as demais iniciam desligadas/silenciadas. O
snapshot é transitório no navegador e não é persistido.

O encerramento definitivo usa `TESDialog`, é exclusivo do terapeuta e só fica
disponível nos cinco minutos finais. A saída comum chama `leave(false)`, volta
à sala de espera e preserva a reconexão; ela nunca abre feedback. O navegador
não chama `leave(true)`: o encerramento para todos passa pelo backend, que
valida ownership, janela e sessão ativa antes de acionar o provedor. A mesma
tela pode reabrir o feedback pelo detalhe com `?feedback=1`; isso não cria uma
rota nova. O feedback usa `session_feedback` e é independente de `reviews`
públicos.
O read model administrativo mostra respostas pendentes e divergentes sem
editar opiniões ou alterar pagamento, repasse, reembolso, booking ou confirmação
de serviço.

A experiência de preparação usa capa abstrata da terapia, horário, contador,
status de entrada, preflight e estados honestos de erro/reconexão. Na sala de
vídeo ativa, a contagem antes do início não é exibida; após o início, aparece
somente o tempo restante até o fim agendado. Música de
ambiente é opcional e só pode ser reproduzida depois de uma interação explícita
do usuário; sem asset ou fonte licenciada, o controle permanece inativo. Nenhum
retrato fictício, áudio, vídeo, transcrição, URL privada, JWT ou identificador
do Zoom é persistido para compor a sala.

Quando o detalhe do encontro está dentro da janela ativa e o pagamento está
confirmado, o CTA pode abrir a sala de espera mesmo antes da presença do
terapeuta. Isso preserva o host-first: a tela de espera é acessível, mas o
paciente só recebe acesso de join depois do evento confiável do terapeuta.

O feedback privado fica disponível após o fim programado ou encerramento
definitivo da sessão. A query `feedback=1` apenas pede a abertura da
experiência; não altera essa decisão. A telemetria confiável de entrada de
paciente e terapeuta continua como evidência e sinal de risco, mas não bloqueia
o envio manual nem os vencimentos automáticos de 7/30 dias. O participante
informa se o encontro ocorreu; uma resposta `not_performed` exige motivo,
bloqueia o repasse e abre revisão administrativa.

Na homologacao principal, esse passo 1 deve vir de Checkout Stripe test e
webhook assinado. Fixtures com pagamento direto sao permitidas somente para
diagnostico isolado do Video SDK e nao autorizam declarar o fluxo
transacional homologado.

## Banco

- `video_sessions`: uma sessao logica local por booking.
- `video_session_participations`: eventos minimos de entrada e saida.
- `zoom_video_webhook_events`: idempotencia e auditoria sanitizada.
- `video_session_control_jobs`: jobs idempotentes de encerramento e reconciliacao
  processados por `zoom-video-session-maintenance`.
- `patient_video_session_summary_v` e `therapist_video_session_summary_v`:
  resumos seguros sem token, segredo, URL ou conteudo clinico.

`session_name` e `user_key` sao opacos. Eles nao carregam nome, e-mail,
diagnostico, terapia ou identificador interno legivel. O browser nunca define
`role_type`, `session_name`, `user_key` ou JWT.

`therapist_token_issued_at` audita emissao de JWT; nao significa presenca. O
paciente so e liberado quando `therapist_first_joined_at`,
`therapist_present=true` e `provider_session_id` refletem evento confiavel do
Zoom.

## Concorrencia

Video SDK cria sessoes sob demanda no primeiro `join`; nao ha sala remota
pre-criada, host Zoom cadastrado no banco, pool de hosts nem worker de
criacao local da sessao. Isso permite multiplas sessoes simultaneas independentes para
diferentes terapeutas e pacientes.

## Custos

O consumo segue a metrica operacional do Zoom Video SDK, como
participant-minutes. `ALLOW_REAL_ZOOM=false` bloqueia testes externos para nao
consumir creditos.

Encerramento de emergencia usa a REST API oficial
`PUT /videosdk/sessions/{sessionId}/status` com `{ "action": "end" }`.
Como IDs reais podem conter `/`, o `sessionId` e codificado duas vezes no path.

## Duracao e Abandono

`ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` e obrigatorio no runtime real. O fim
duro salvo em `hard_ends_at` e um watchdog operacional, nao a duracao da
reserva:

```text
actual_started_at + ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES
```

Em HML, a configuracao atual e 240 minutos. O encerramento normal ocorre em
`scheduled_ends_at` pela operacao duravel `end_scheduled`; somente uma sessao
orfa protegida pelo watchdog usa `end_hard_timeout`. O navegador calcula todo
contador visivel com `scheduled_starts_at`, `scheduled_ends_at` e `serverNow`,
nunca com `hard_ends_at`.

A janela abre em T-15. Abrir a sala de espera autenticada registra
`zoom_waiting_room_entered` para a versão atual da reserva até T+10 inclusive.
Essa chegada pontual, ou um `session.user_joined` confiável anterior, preserva
a reconexão até `scheduled_ends_at`; cada entrada ainda exige presença atual do
terapeuta. T+10+1 ms é bloqueado sem uma dessas evidências.

Somente o terapeuta pode encerrar para todos no intervalo fechado em T-5 e
aberto no fim agendado. O encerramento confirmado nessa janela libera feedback;
um fechamento precoce do provedor não confirma realização e aguarda
`scheduled_ends_at`. Se o Zoom emitir `session.ended` porque o último
participante saiu antes desse horário, a sessão lógica permanece `active`, a
instância remota é descartada e a reentrada cria uma nova instância para o mesmo
`session_name`. A presença fica falsa nesse intervalo e a regra host-first
continua válida até o terapeuta reentrar. A grace de 120 segundos permanece
somente como parâmetro de compatibilidade e reconciliação técnica: não expira o
encontro. `manual_end`, `end_scheduled` e `end_hard_timeout` são operações
terminais independentes.

Se o terapeuta sair, o paciente nao recebe novo JWT durante a ausencia. A
maintenance encerra sessoes somente no fim agendado, por hard timeout ou para
confirmar um encerramento manual previamente autorizado. Jobs legados de
ausencia/orfandade sao concluídos como superseded e nunca chamam a REST API do
provider. Sessões já confirmadas como `ended` não são reabertas automaticamente.

## Ciclo de vida no navegador

O cliente do Video SDK e singleton. Cada tentativa possui uma geracao; eventos
de geracoes anteriores sao ignorados. Uma reentrada aguarda integralmente a
limpeza e o `destroyClient` da tentativa anterior antes de chamar
`createClient`, preservando o `user_key` deterministico e evitando participantes
fantasmas. O `requestId` retornado pela emissao de acesso permite correlacionar
o codigo sanitizado do browser com os logs da Edge Function sem persistir token
ou mensagem interna do Zoom.

Timers e operações de vídeo local/remoto pertencem ao conjunto
`generation + client + stream`. O cleanup invalida a geração, aguarda attaches
pendentes dentro do deadline e desanexa pelo par `userId + element`; uma
operação antiga nunca pode anexar ou remover elementos da tentativa nova. Cada
container mantém no máximo um player, e um elemento já pertencente ao self-view
ou ao remoto não pode ser movido para o outro quadro.

A fila de limpeza vive no modulo, e nao na instancia React. Assim, navegar para
tras e montar novamente a rota nao perde a Promise de `destroyClient` que ainda
pertence a instancia anterior. Durante uma queda de internet, o relogio de
recuperacao fica pausado e e retomado pelo evento `online`. Um evento
`connection-change: Closed` so encerra o fluxo quando o codigo ou motivo indicar
fim pelo host/remocao; fechamentos transitorios seguem a mesma recuperacao de
`Fail`.

A recuperacao transitoria e sempre habilitada: reutiliza o mesmo acesso ja
emitido, nunca pede JWT adicional e executa no maximo tres `join`s dentro da
janela de recuperacao. Isso impede que uma flag publica deixe o ambiente de
homologacao/producao sem recuperacao justamente quando o singleton do SDK esta
em transicao.
