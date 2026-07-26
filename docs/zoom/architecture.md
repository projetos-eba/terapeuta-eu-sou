# Arquitetura Zoom

## Visão

O Zoom é provedor operacional de videoconferência. Pagamento continua sob Stripe e `session_payments`; Zoom nunca confirma pagamento, repasse ou realização financeira.

Fluxo:

1. Stripe confirma pagamento por webhook.
2. `stripe-billing-webhook` aplica estado financeiro em `apply_session_payment_state_v1`.
3. Quando o estado é `paid`, enfileira `zoom_meeting_jobs` por `enqueue_zoom_meeting_job_v1`.
4. `zoom-jobs-process` cria ou atualiza a reunião via Server-to-Server OAuth.
5. Paciente/terapeuta pedem acesso por `/api/zoom/meeting-access`.
6. `zoom-meeting-access` valida perfil, booking, pagamento, janela de entrada e gera JWT do Meeting SDK.
7. `zoom-webhook` valida assinatura, registra evento normalizado e atualiza estado operacional.

## Banco

- `zoom_meetings`: fonte canônica local da reunião Zoom.
- `zoom_meeting_jobs`: outbox de create/update/cancel/reconcile.
- `zoom_webhook_events`: idempotência e auditoria sanitizada de webhooks.
- `zoom_meeting_participations`: evidências operacionais de presença sem conteúdo clínico.
- `patient_zoom_meeting_summary_v` e `therapist_zoom_meeting_summary_v`: resumos sem secrets.

`bookings.meeting_url` permanece legado e não deve receber `start_url`.

## Jobs e idempotência

`reserve_zoom_meeting_job_v1` reserva um job por vez, respeita `max_attempts` e recupera locks `processing` antigos. `complete_zoom_meeting_job_v1` encerra jobs com `completed_at` em sucesso, falha final ou `dead_letter`.

Antes de criar ou atualizar uma sala, `zoom-jobs-process` revalida o booking e confirma `session_payments.financial_status = paid`. Cancelamento remoto trata `404` do Zoom como sucesso idempotente. Reconcile nunca recria sala duplicada quando a reunião remota esperada desapareceu; marca a sala local como `failed` para investigação.

## Webhooks

`zoom-webhook` limita corpo bruto, valida assinatura/timestamp antes de persistir, responde `endpoint.url_validation` e ignora eventos não suportados de forma explícita. Eventos suportados atualizam apenas estado operacional de reunião e participação.

Eventos `meeting.started` recebidos depois de `meeting.ended`, `canceled` ou `failed` não regridem o estado local.

## Segurança

O browser nunca recebe Client Secret, Account ID, token S2S, webhook secret, `start_url` ou ZAK de paciente. O terapeuta recebe ZAK apenas no momento de iniciar a sala e somente após autorização de backend.

Topic enviado ao Zoom usa referência opaca curta. Não enviar terapia, queixa, diagnóstico, objetivo clínico ou nome completo do cliente.

Passcodes gerados localmente respeitam limite de 10 caracteres observado na configuração real da conta Zoom usada em desenvolvimento.
