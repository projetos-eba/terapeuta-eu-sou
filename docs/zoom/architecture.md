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
6. O backend calcula `role_type`: paciente `0`, terapeuta responsavel `1`.
7. O backend gera JWT curto do Video SDK e devolve somente `sdkKey`,
   `sessionName`, `token`, `userName`, `roleType` e passcode nulo.
8. O browser inicializa `@zoom/videosdk` e entra na sessao.
9. A sessao Zoom comeca quando o primeiro usuario autorizado entra.
10. Webhooks `session.*` atualizam inicio, fim e participacoes operacionais.

## Banco

- `video_sessions`: uma sessao logica local por booking.
- `video_session_participations`: eventos minimos de entrada e saida.
- `zoom_video_webhook_events`: idempotencia e auditoria sanitizada.
- `patient_video_session_summary_v` e `therapist_video_session_summary_v`:
  resumos seguros sem token, segredo, URL ou conteudo clinico.

`session_name` e `user_key` sao opacos. Eles nao carregam nome, e-mail,
diagnostico, terapia ou identificador interno legivel. O browser nunca define
`role_type`, `session_name`, `user_key` ou JWT.

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
