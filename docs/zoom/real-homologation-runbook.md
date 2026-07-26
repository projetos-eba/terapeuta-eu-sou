# Runbook de Homologacao Real Zoom Video SDK

Este runbook descreve a homologacao real curta da integracao Zoom Video SDK do
TES. Nao execute em producao e nao abra mais de uma sessao real sem autorizacao
explicita.

## Pre-requisitos

- Supabase local rodando e Edge Functions locais servidas.
- `supabase/functions/.env` com `ALLOW_REAL_ZOOM=true`.
- `ZOOM_ENVIRONMENT=development`.
- SDK Key/Secret, API Key/Secret e webhook secret do app Video SDK correto.
- `NGROK_AUTHTOKEN` configurado localmente.
- Permissao para criar fixtures temporarias locais/staging com service role.
- Nenhuma sessao Video SDK ativa antes do teste.
- Capacidade de encerramento pelo host e pela REST API Video SDK.

## Custo e Consumo

O Zoom Video SDK pode contabilizar uso quando participantes entram na sessao.
Use uma unica sessao curta, com camera desligada e microfone silenciado. A meta e
10 a 20 segundos, com limite operacional de 30 segundos e watchdog de 60
segundos.

## Comandos Locais

```bash
npm install
npm run zoom:video-sdk:env
npm run zoom:video-sdk:test
npm run zoom:video-sdk:api:mock
npm run zoom:video-sdk:webhook:smoke
npm run test
npm run test:coverage
npm run test:deno
npm run typecheck
npm run lint
npm run build
npx supabase status
npx supabase db reset
npx supabase db lint
npx supabase test db
npx supabase gen types typescript --local --schema public
```

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
credenciais presentes e nenhuma sessao ativa. Se houver HTTP 401/403, pare e
revise as credenciais do app Video SDK.

## Fixtures

Nao configure booking, e-mail ou senha manualmente. O script real cria em
runtime:

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
npm run zoom:video-sdk:test:real -- --base-url http://127.0.0.1:3000
```

`--base-url` e opcional. Sem argumento, o script usa `NEXT_PUBLIC_SITE_URL` ou
`http://127.0.0.1:3000`.

O fluxo autorizado para a sessao real e:

1. Terapeuta entra primeiro com `role_type=1`.
2. Paciente entra em seguida com `role_type=0`.
3. Camera permanece desligada e audio silenciado.
4. Confirmar join dos dois, presenca e evento `user-added`.
5. Terapeuta encerra imediatamente para todos com `client.leave(true)`.
6. Confirmar `connection-change/Closed`, webhooks `session.user_left` e
   `session.ended`, e estado local `ended`.

## Watchdog

Se o encerramento normal falhar, use a REST API oficial:

```http
PUT /videosdk/sessions/{sessionId}/status
{ "action": "end" }
```

Nao use `DELETE /videosdk/sessions/{sessionId}` para encerrar sessao iniciada.

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
