# Arquitetura Zoom Video SDK

O TES usa Zoom Video SDK como provedor operacional de audio e video dentro do
site. Pagamento, elegibilidade financeira, repasse e confirmacao de servico
continuam sob Stripe, `session_payments`, ledger e regras internas.

## Fluxo

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

Antes do join, a sala de espera pode abrir uma prévia exclusivamente local no
navegador: o teste de câmera solicita somente vídeo e substitui a capa visual;
o teste de áudio solicita somente microfone e mostra um indicador local. Esses
streams não inicializam o Video SDK, não solicitam acesso à sala, não emitem
JWT e são encerrados ao desligar o teste, entrar, falhar ou desmontar a tela.

O encerramento usa `TESDialog`. Depois de sair, paciente e terapeuta permanecem
na rota canônica da sala e podem registrar feedback bilateral privado. A mesma
tela pode ser reaberta pelo detalhe com `?feedback=1`; isso não cria uma rota
nova. O feedback usa `session_feedback` e é independente de `reviews` públicos.
O read model administrativo mostra respostas pendentes e divergentes sem
editar opiniões ou alterar pagamento, repasse, reembolso, booking ou confirmação
de serviço.

A experiência de preparação usa capa abstrata da terapia, horário, contador,
status de entrada, preflight e estados honestos de erro/reconexão. Música de
ambiente é opcional e só pode ser reproduzida depois de uma interação explícita
do usuário; sem asset ou fonte licenciada, o controle permanece inativo. Nenhum
retrato fictício, áudio, vídeo, transcrição, URL privada, JWT ou identificador
do Zoom é persistido para compor a sala.

Quando o detalhe do encontro está dentro da janela ativa e o pagamento está
confirmado, o CTA pode abrir a sala de espera mesmo antes da presença do
terapeuta. Isso preserva o host-first: a tela de espera é acessível, mas o
paciente só recebe acesso de join depois do evento confiável do terapeuta.

O feedback de qualidade só muda para elegível quando o backend encontra entrada
confiável de paciente e terapeuta e o encerramento efetivo ou programado da
sessão. A query `feedback=1` apenas pede a abertura da experiência; não altera
essa decisão. Se só um participante entrou, a interface oferece somente o
relato de ocorrência quando o estado da sessão permitir.

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

A janela abre em T-15. A primeira entrada do paciente e aceita ate T+15
inclusive; depois, apenas um `session.user_joined` confiavel anterior autoriza
reconexao. Toda entrada termina em `scheduled_ends_at`.

Se o terapeuta sair, o paciente nao recebe novo JWT durante a ausencia. A
maintenance encerra sessoes por hard timeout, ausencia prolongada do terapeuta
ou orfandade operacional, usando locks e backoff em banco.
