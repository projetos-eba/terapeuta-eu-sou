# Runbook de Homologacao Real Zoom Video SDK

Este runbook descreve a homologacao real curta da integracao Zoom Video SDK do
TES. Nao execute em producao e nao abra mais de uma sessao real sem autorizacao
explicita.

## Pre-requisitos

- Supabase local rodando e Edge Functions locais servidas.
- `supabase/functions/.env` com `ALLOW_REAL_ZOOM=true`.
- `ZOOM_ENVIRONMENT=development`.
- `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` configurado como inteiro positivo
  entre 1 e 240. Em fluxo real/producao nao ha fallback.
- SDK Key/Secret, API Key/Secret e webhook secret do app Video SDK correto.
- `NGROK_AUTHTOKEN` configurado localmente.
- Permissao para criar fixtures temporarias locais/staging com service role.
- Nenhuma sessao Video SDK ativa antes do teste.
- Capacidade de encerramento pelo host e pela REST API Video SDK.

## Harness HML remoto

Use o harness HML separado para validar a sessao real contra o app remoto com
contexts de cliente, terapeuta e Admin. Ele pode resolver uma booking elegivel
ja existente ou preparar uma nova pelo Checkout Stripe test real. Nunca cria
pagamento direto, nao usa `supabase status` local como evidencia remota e nao
faz deploy.

Variaveis obrigatorias no mesmo processo do comando:

- `PLAYWRIGHT_BASE_URL` ou `ZOOM_HML_BASE_URL` apontando para
  `https://hml.terapeutaeusou.com.br/...?_vercel_share=...`
- `SUPABASE_URL` apontando para o projeto HML
  `emzwqkmrryuqvqiohqnu`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZOOM_HML_PATIENT_EMAIL`
- `ZOOM_HML_THERAPIST_EMAIL`
- `ZOOM_HML_ADMIN_EMAIL`

Com IDs preexistentes, continuam aceitas:

- `ZOOM_HML_BOOKING_ID`
- `ZOOM_HML_SESSION_PAYMENT_ID`
- `ZOOM_HML_VIDEO_SESSION_ID`

Sem IDs, use `--resolve-canonical-hml-fixture`. Para criar uma nova reserva
quando nenhuma elegivel existir, acrescente `--prepare-canonical-hml-fixture`.
Esse modo usa um servico online bookable real do terapeuta informado, restaura
no `finally` qualquer regra temporaria de disponibilidade e confirma Checkout,
webhook Stripe processado, pagamento `paid` e `video_session` antes de abrir o
Zoom.

As senhas permanecem aceitas no modo legado. Para nao depender de senhas
estaticas, `--use-admin-magic-link-sessions` gera sessoes de uso unico em memoria
via Auth Admin e injeta somente os cookies HTTP-only de cada context. Nenhum
token e impresso ou gravado na evidencia.

O harness falha fechado quando qualquer item acima estiver ausente, quando a URL
nao trouxer `_vercel_share`, quando o Supabase nao for HML remoto, quando a
booking nao estiver `confirmed` + `payment_status = paid`, quando
`session_payments.financial_status != paid`, quando `video_sessions` nao
corresponder ao `booking_id`, quando `provider_session_id` ja existir antes do
inicio, quando a reserva nao estiver entre 15 e 20 minutos antes do horario
agendado, ou quando houver sessao Zoom ativa antes do teste.

Execucao:

```bash
node scripts/homologation/zoom-hml.mjs \
  --confirm-single-hml-session \
  --confirm-hml-vercel-share \
  --prepare-canonical-hml-fixture \
  --resolve-canonical-hml-fixture \
  --use-admin-magic-link-sessions \
  --duration-seconds=45
```

Regras do harness HML:

1. Playwright sempre visivel (`headless: false`).
2. Contexts separados para cliente, terapeuta e Admin.
3. Captura `console`, `pageerror`, `requestfailed` e respostas HTTP >= 400 com
   sanitizacao de `_vercel_share`, JWT, e-mail, UUID, tokens e secrets.
4. Paciente acessa antes de T-15 e o harness comprova que a entrada permanece
   bloqueada; a espera automatica ate T-15 e limitada a 5 minutos.
5. Em T-15, o paciente entra na sala de espera e permanece bloqueado enquanto
   o terapeuta estiver ausente.
6. Terapeuta entra, o harness valida `therapist_present=true`,
   `provider_session_id` e `hard_ends_at` via Supabase HML.
7. Paciente entra apenas depois da presenca confiavel do terapeuta.
8. O harness nega e concede novamente a permissao de camera do paciente. Depois
   liga primeiro a camera do terapeuta, confirma o video remoto no paciente,
   liga a camera do paciente e confirma que ambos mantem self-view e remoto.
9. Durante a chamada, valida desktop, tablet, mobile de 390px e viewport mobile
   baixo, sem overflow da pagina e com audio, camera e saida dentro do viewport.
   Essa evidencia Chromium nao substitui Safari/iPhone e Chrome/Android reais.
10. O paciente sai individualmente, volta à espera e reconecta após T+10 usando
    a chegada pontual já registrada. Repetir por suporte, voltar, refresh e
    outro dispositivo.
11. Antes de T-5, o harness comprova que `Encerrar para todos` permanece
    bloqueado. Em T-5, o terapeuta confirma o encerramento definitivo pelo
    backend; o navegador nunca usa `leave(true)`.
12. Após o encerramento confirmado, o harness valida a tela de feedback para paciente e terapeuta,
    registra uma resposta realizada ou não realizada e confirma no Admin a
    leitura bilateral, a pendência ou a divergência sem edição.
13. Em caso de falha durante cleanup, o fallback permitido e `PUT
/videosdk/sessions/{sessionId}/status` via `endSessionByApi`; o harness nunca
   grava fixture paga direta nem atualiza `video_sessions` manualmente.
14. Evidencia final fica em `.tmp/homologation/zoom-hml-*/evidence.json`,
    somente com IDs em hash.

Reflexos exigidos:

- Paciente: espera antes do host e bloqueio do CTA apos encerramento.
- Terapeuta: entrada host-first, controles do SDK e encerramento para todos.
- Admin: `/admin/sessoes/:bookingId` carrega detalhes antes e depois da sessao
  sem expor URL secreta, JWT ou `provider_session_id`.

## Custo e Consumo

O Zoom Video SDK pode contabilizar uso quando participantes entram na sessao.
Use uma unica sessao curta, com camera desligada e microfone silenciado. A meta
de HML e 30 a 60 segundos. O limite duro vem de
`ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES`, usado apenas como watchdog de sessao
orfa (240 minutos em HML); a duracao exibida e o encerramento normal vem da
reserva. O harness visual tem watchdog local de 180 segundos.

## Comandos Locais

```bash
npm install
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npx vitest run scripts/homologation/zoom-hml.test.mjs
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:webhook:smoke
npm run test
npm run test:coverage
npm run test:deno
npm run typecheck
npm run lint
npm run build
npx supabase status
npx supabase db lint
npx supabase test db
npx supabase gen types typescript --local --schema public
npm run format:check
```

`npx supabase db reset` não faz parte do fluxo de homologação e só deve ser
executado com decisão explícita quando uma reconstrução completa do banco local
for necessária. O comando único preserva a configuração e os dados de teste
locais por padrão.

## Ngrok

Em um terminal com as Edge Functions locais ativas:

```bash
npm run zoom:video-sdk:webhook:tunnel
```

O script imprime a URL publica e grava metadados nao secretos em
`.tmp/zoom-real-homologation.json`:

```text
https://<subdominio-ngrok>/functions/v1/zoom-webhook
```

Mantenha o processo ativo ate encerrar a homologacao. Pressione `Ctrl+C` para
parar o tunel.

O túnel é obrigatório durante toda a sessão real. Um `real-verify` bem-sucedido
sem o processo do túnel ativo não garante entrega dos eventos
`session.user_joined` e `session.user_left`.

## Configuracao Manual no Zoom

Na Zoom Build Platform, configure manualmente:

- Event notification endpoint URL:
  `https://<subdominio-ngrok>/functions/v1/zoom-webhook`
- Eventos:
  - `session.started`
  - `session.ended`
  - `session.user_joined`
  - `session.user_left`
- Secret token igual ao ambiente local.

Clique em `Validate` e so continue se a validacao passar, os quatro eventos
estiverem selecionados e o endpoint estiver ativo. Uma nova URL ngrok exige nova
configuracao manual no Zoom.

## Verificacao do Webhook Publico

Depois de configurar a URL temporaria:

```bash
npm run zoom:video-sdk:webhook:real-verify
```

Esse comando le a URL temporaria do arquivo `.tmp/zoom-real-homologation.json`.
Tambem aceita argumento explicito ou `ZOOM_PUBLIC_WEBHOOK_URL` local quando a
URL ja foi configurada manualmente. Em caso de sucesso, registra a confirmacao
no mesmo arquivo com timestamp e validade curta. O arquivo nao contem secrets.

## Preflight Real

```bash
npm run zoom:video-sdk:real-preflight
```

O comando deve confirmar `ALLOW_REAL_ZOOM=true`, ambiente `development`,
credenciais presentes, `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` valido e
nenhuma sessao ativa. Se houver HTTP 401/403, pare e revise as credenciais do
app Video SDK.

## Gate Manual Obrigatorio

Antes de abrir a sessao real, confirme visualmente na Zoom Build Platform:

- endpoint URL igual a URL ngrok atual;
- endpoint validado/ativo;
- eventos `session.started`, `session.ended`, `session.user_joined` e
  `session.user_left` selecionados;
- nenhuma sessao Video SDK ativa no preflight;
- autorizacao para consumir no maximo uma sessao curta.

Essa confirmacao nao e persistida em `.env` nem no arquivo temporario. Ela deve
ser passada no comando do teste real por flags momentaneas.

## Comando unico

Use o comando abaixo como entrada principal da homologacao local:

```bash
npm run homologation:zoom:local
```

Ele valida ferramentas, ambiente local, Supabase, migrations, pgTAP, Edge
Functions, Next, Stripe CLI, testes locais do Zoom, webhook publico validado,
preflight real e cleanup. Logs e evidencias sanitizadas ficam em
`.tmp/homologation/<runId>/`.

O comando captura o signing secret temporario do Stripe CLI sem imprimi-lo e o
injeta somente no processo local das Edge Functions. Se o Stripe CLI, ngrok,
webhook Zoom, Supabase local ou qualquer gate real falhar, o processo para antes
de abrir uma sessao Zoom.

## Fixtures e pagamento

Para a homologacao transacional principal, o pagamento precisa ser criado pelo
fluxo real:

1. paciente autenticado escolhe horario em `/reserva`;
2. `/api/public/reservation/checkout` chama `session-booking-checkout`;
3. `stripe-create-session-payment` cria Checkout Session test;
4. Playwright navega pelo Checkout/Embedded Checkout;
5. Stripe CLI encaminha evento assinado para a Edge Function local;
6. `stripe-billing-webhook` marca `session_payments.financial_status = paid`;
7. o webhook chama `ensure_video_session_for_paid_booking_v1`;
8. `.tmp/zoom-real-homologation.json` registra evidencia nao secreta em
   `canonicalPayment`.

O harness tecnico `npm run zoom:video-sdk:test:real` nao e mais aceito como
homologacao principal quando cria `session_payments` diretamente. A flag
`--allow-direct-paid-fixture-for-zoom-only` deve ser usada somente para
diagnostico isolado do Video SDK, depois de registrar que o pagamento canonico
continua pendente.

O script real tecnico cria em runtime:

- usuario terapeuta;
- perfil aprovado Premium Plus;
- usuario paciente;
- perfil de paciente;
- servico;
- disponibilidade;
- booking confirmada dentro da janela;
- `session_payments.financial_status = paid`;
- `video_sessions` via RPC canonica `ensure_video_session_for_paid_booking_v1`.

Os e-mails usam `runId` unico e as senhas existem somente em memoria. O cleanup
remove as fixtures em bloco `finally`, respeitando FKs.

## Execucao

```bash
npm run zoom:video-sdk:test:real -- --confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=250 --base-url http://127.0.0.1:3000
```

`--base-url` e opcional. Sem argumento, o script usa `NEXT_PUBLIC_SITE_URL` ou
`http://127.0.0.1:3000`.

O fluxo autorizado para a sessao real e:

1. Paciente abre a pagina primeiro e fica bloqueado na sala de espera.
2. Nenhum JWT de paciente e emitido enquanto o webhook nao confirmar o host.
3. Terapeuta entra com `role_type=1`.
4. Webhook `session.user_joined` do terapeuta grava presenca confiavel.
5. Paciente atualiza a sala, recebe `role_type=0` e entra.
6. Cada participante roda em `BrowserContext` isolado.
7. Camera permanece desligada e audio silenciado.
8. Capturar o `provider_session_id` ativo sem imprimir o valor completo.
9. Confirmar join dos dois.
10. Terapeuta encerra imediatamente para todos com `client.leave(true)`.
11. Confirmar via API que nao ha sessao ativa.
12. Confirmar no banco eventos processados `session.started`, `session.ended`,
    `session.user_joined` e `session.user_left`, participacoes com saida para
    terapeuta/paciente e `video_sessions.status = ended`.

O harness recusa execucao sem `--headed` e `--slow-mo=<ms>` positivo.
Sem a flag diagnostica, ele tambem recusa execucao sem evidencia de pagamento
canonico por Stripe Checkout + webhook.

O harness HML remoto nao aceita fixture paga direta em nenhuma circunstancia.
Ele exige booking, `session_payment` e `video_session` preexistentes no
Supabase HML remoto e nao usa flags de bypass equivalentes a
`--allow-direct-paid-fixture-for-zoom-only`.

## Duracao, Presenca e Maintenance

O fim efetivo e calculado no servidor como:

```text
min(inicio efetivo + ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES,
    fim agendado + tolerancia existente)
```

`video_sessions.hard_ends_at` e preenchido a partir do primeiro evento confiavel
do provedor. `therapist_token_issued_at` e apenas auditoria de JWT emitido; a
liberacao do paciente depende de `therapist_first_joined_at`,
`therapist_present=true` e `provider_session_id`.

A Edge Function `zoom-video-session-maintenance` enfileira e processa jobs
duraveis em `video_session_control_jobs`: `end_hard_timeout`,
`end_therapist_absent`, `reconcile_orphan` e `confirm_end`. O cron versionado em
`supabase/schedules/zoom-video-session-maintenance.sql` usa pg_cron, pg_net e
Vault, sem segredo hardcoded.

## Watchdog

Se o encerramento normal falhar, use a REST API oficial:

```http
PUT /videosdk/sessions/{sessionId}/status
{ "action": "end" }
```

Nao use `DELETE /videosdk/sessions/{sessionId}` para encerrar sessao iniciada.
IDs reais de sessao podem conter `/`; scripts e workers devem codificar o
`sessionId` duas vezes antes de coloca-lo no path do endpoint de status.
O harness tem watchdog de 180 segundos e executa cleanup single-flight. Se o
processo interromper depois de capturar a sessao, rode:

```bash
npm run zoom:video-sdk:emergency-end
```

O comando le somente o `provider_session_id` temporario em
`.tmp/zoom-real-homologation.json`, encerra pela API oficial e limpa esse
metadado. Ele nao imprime o ID completo.

Se uma versao antiga do harness nao capturou o ID, mas o preflight mostra
exatamente uma sessao ativa, use a variante segura:

```bash
npm run zoom:video-sdk:emergency-end -- --active-singleton
```

Essa variante recusa execucao quando houver zero ou mais de uma sessao ativa.

## Diagnostico de Sessao Orfa

Execute:

```bash
npm run zoom:video-sdk:real-preflight
```

Se houver sessao ativa inesperada, nao abra outra. Encerre via host se possivel;
se nao, use o endpoint oficial de status pela rotina operacional segura e
confirme novamente.

## Pos-teste

- Verificar que nenhuma sessao ativa permanece.
- O script deve comprovar cleanup de fixtures. Se nao comprovar, ele falha e
  imprime IDs sanitizados e procedimento manual.
- Remover a URL ngrok temporaria do Zoom ou desativar o endpoint.
- Parar o tunel com `Ctrl+C`.
- Recomendar e aplicar manualmente, quando autorizado:

```text
ALLOW_REAL_ZOOM=false
```

## Checklist Final

- Testes locais passaram.
- Webhook validado manualmente no Zoom.
- Uma unica sessao real curta foi aberta.
- Participantes corretos e roles corretos.
- Sessao encerrada com evidencia.
- Nenhuma sessao orfa identificada.
- Nenhum secret, JWT, session name completo ou user key completo foi logado.
- Rate limit de emissao de token validado pela RPC distribuida
  `reserve_zoom_video_access_issue_v1`.
