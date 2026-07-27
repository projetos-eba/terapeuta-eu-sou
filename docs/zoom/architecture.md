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

O proxy Next envia `actorRole` e seleciona explicitamente o cookie desse papel.
A Edge Function rejeita mismatch para impedir token cruzado entre paciente e
terapeuta.

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
duro salvo em `hard_ends_at` segue:

```text
min(inicio efetivo + maximo configurado, fim agendado + tolerancia existente)
```

Se o terapeuta sair, o paciente nao recebe novo JWT durante a ausencia. A
maintenance encerra sessoes por hard timeout, ausencia prolongada do terapeuta
ou orfandade operacional, usando locks e backoff em banco.
