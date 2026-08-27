# Testes Zoom Video SDK

Nesta rodada `ALLOW_REAL_ZOOM=false`.

Permitido:

- unitarios de ambiente, JWT, assinatura, challenge e sanitizacao;
- Vitest com mock de `@zoom/videosdk`;
- smoke local de webhook assinado;
- API mockada;
- Supabase local com `db reset`, `db lint` e pgTAP.

Nao permitido com `ALLOW_REAL_ZOOM=false`:

- iniciar sessao real;
- entrar em sessao real;
- chamar REST API real do Zoom;
- abrir tunel publico;
- consumir creditos.

Comandos:

```bash
npm run homologation:zoom:local
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npm run zoom:video-sdk:webhook:smoke
npm run zoom:video-sdk:webhook:real-preflight
npm run zoom:video-sdk:webhook:tunnel
npm run zoom:video-sdk:webhook:real-verify -- https://<subdominio-ngrok>/functions/v1/zoom-webhook
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:real-preflight
npm run zoom:video-sdk:test:real
npm run zoom:video-sdk:emergency-end
```

`zoom:video-sdk:test:real` recusa execucao quando qualquer gate real estiver
incompleto: webhook nao validado ou expirado em
`.tmp/zoom-real-homologation.json`, URL ngrok divergente, sessao ativa
preexistente, Supabase nao local/staging autorizado ou ambiente diferente de
`development`, ou `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` ausente/invalido.
Ele tambem exige as flags momentaneas
`--confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=<ms>`,
depois da validacao manual no Zoom Build Platform. Para homologacao principal,
use `npm run homologation:zoom:local`; o harness tecnico
`zoom:video-sdk:test:real` fica bloqueado por padrao se depender de pagamento
direto em fixture. A flag `--allow-direct-paid-fixture-for-zoom-only` e restrita
a diagnostico isolado do Video SDK e nao conclui a homologacao Stripe + Zoom.

O fluxo real e host-first: paciente abre a tela primeiro e fica em sala de
espera sem receber JWT; terapeuta entra; webhook `session.user_joined` confirma
presenca; paciente e liberado por `preview` e so entao consome um token.

A matriz local também cobre a janela anterior a T-15, a sala visual em T-15,
terapeuta ausente, terapeuta presente aguardando paciente, ambos presentes,
encerramento, reconexão e indisponibilidade de rede. O acesso por
`feedback=1` é exercitado antes, durante e depois da sessão para confirmar que
somente a evidência server-side de ambos os joins torna o feedback de qualidade
elegível.

A sala de espera também deve comprovar que as três capas locais aparecem nos
estados corretos, que o teste de câmera solicita apenas vídeo, que o teste de
áudio solicita apenas microfone, e que os tracks de prévia são liberados ao
entrar ou sair. Áudio ambiente sem fonte licenciada permanece visível, porém
inativo e sem autoplay.

O teste do adapter deve cobrir os dois papéis: com câmera e microfone ligados
na sala de espera, o `join` deve chamar a ativação das duas mídias na sala
ativa; sem uma mídia habilitada no preflight, ela deve permanecer desligada.
Essa preferência não é persistida e é enviada somente no clique de entrada.

A sala ativa deve iniciar o SDK com `enforceMultipleVideos: true`, usar
`video-player-container` e provar câmera bidirecional na ordem: terapeuta liga,
paciente vê o remoto, paciente liga, terapeuta vê o remoto e as duas telas
permanecem anexadas. Presença do participante e vídeo remoto anexado são
asserts diferentes. Safari/iPhone e Chrome/Android reais são obrigatórios em
HML; emulação de viewport Chromium não substitui esses gates.

O teste de adapter deve reproduzir também o `user-updated` incremental emitido
quando o paciente liga a própria câmera. Um payload contendo apenas o usuário
local, ou uma atualização remota sem `bVideoOn`, não pode chamar `detachVideo`
para o terapeuta nem substituir o tile remoto por “Aguardando”.

Os testes temporais cobrem T-15, chegada em T+10, bloqueio em T+10+1 ms,
reconexão por chegada da versão atual ou join confiável e bloqueio em
`scheduled_ends_at`. Para 17:45–18:35, o contador mostra 7 minutos antes do
início às 17:38, 50 minutos às 17:45 e 40 minutos às 17:55. Alterar o watchdog
não altera esses valores. Na sala de vídeo ativa, o contador antes do início
fica oculto; a contagem até o fim aparece a partir do horário agendado. A sala
de espera mantém a contagem regressiva até a abertura.

Após uma saída individual, a sala deve voltar à espera e permitir nova entrada
enquanto o terapeuta estiver presente; suporte, voltar, refresh e troca de
dispositivo não removem a chegada pontual. Feedback aparece somente após
encerramento definitivo confirmado em T-5 ou no fim programado. O teste cobre
negação antes de T-5, autorização na fronteira, replay idempotente, fechamento
precoce sem confirmação, feedback realizado e não realizado, nota de 1 a 5,
motivos, comentário de 500 caracteres, erro de carregamento, erro de envio,
replay idempotente e tentativa duplicada divergente. O Admin visualiza respostas
ausentes, parciais, completas e conflitantes no detalhe da sessão, sem editar
opiniões e sem alterar estado financeiro ou de realização.

A confirmação bilateral é testada separadamente do feedback: replay idempotente,
confirmação manual por cada papel, confirmação automática após sete dias do fim
programado e elegibilidade um dia depois. Divergência, ausência, reembolso,
disputa, Connect não apto ou qualquer bloqueio financeiro não podem ser
convertidos em repasse pela tela de feedback.

O QA visual deve registrar evidência em `1440x900`, `1024x768`, `390x844` e
`360x800` quando necessário, cobrindo preparação antes de T-15, espera, sala
ativa, saída, feedback elegível, ocorrência e erro. Controles devem manter
44px mínimos, foco visível, labels acessíveis e movimento reduzido.

A emissao de JWT do Video SDK e protegida por rate limit distribuido no
Postgres, via `reserve_zoom_video_access_issue_v1`, para evitar bypass por
multiplas instancias de Edge Function.

O encerramento automatico usa `video_session_control_jobs` e a Edge Function
`zoom-video-session-maintenance`, acionada por cron interno conforme template em
`supabase/schedules/zoom-video-session-maintenance.sql`.

Se o harness falhar antes de capturar `provider_session_id`, ele tenta descobrir
uma sessao ativa unica no cleanup. A rotina operacional
`zoom:video-sdk:emergency-end -- --active-singleton` existe somente para esse
caso e recusa ambiguidades.

Runbook completo: `docs/zoom/real-homologation-runbook.md`.
