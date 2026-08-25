# Scheduler de lembretes de encontros

## Escopo

Esta implementação envia somente os lembretes do paciente:

- `booking_reminder_24h_patient`: `bookings.starts_at - 24 horas`;
- `booking_reminder_1h_patient`: `bookings.starts_at - 1 hora`.

O e-mail aponta para `/app/encontros/:bookingId`. Não são incluídos URL do
Zoom, JWT, segredo, dados clínicos ou dados completos de pagamento.

## Elegibilidade

O job é criado e reclamado somente quando:

- `bookings.status = confirmed`;
- `session_payments.financial_status` é `paid` ou `partially_refunded`;
- `refund_pending = false`;
- não existe disputa, contestação interna ou bloqueio administrativo;
- o encontro ainda não começou;
- a versão do booking é igual à versão armazenada no job.

O horário é calculado com o instante absoluto de `starts_at`. O timezone do
booking é usado na apresentação da data e hora.

## Estados e idempotência

`booking_reminder_jobs` guarda somente referências e estado operacional:
booking, versão, action, paciente, horário-alvo, lease, tentativas, outbox e
erro sanitizado. A chave única é:

`booking_id + booking_version + action_key + recipient_user_id`

O `job.id` é usado como `domain_event_id` da outbox. Dessa forma, uma nova
execução do scheduler retorna a mesma entrega lógica e não cria duplicidade.

O cron usa `FOR UPDATE SKIP LOCKED`, lease de processamento e janela estrita
de um ciclo de um minuto. Jobs não reclamados nesse ciclo tornam-se `missed`;
não há catch-up.

## Eventos do booking

- confirmação: cria os jobs futuros na mesma transação do `booking_event`;
- cancelamento ou refund: cancela jobs pendentes e suprime outbox pendente;
- reagendamento aplicado: cancela jobs da versão anterior e cria jobs para a
  nova versão quando os horários ainda forem futuros;
- o dispatcher realiza uma segunda validação antes de chamar a Hostinger.

## Operação

O job `tes-booking-reminders-v1` executa
`public.run_booking_reminder_scheduler_v1()` a cada minuto. O job separado
`tes-email-outbox-recovery-v1` continua responsável por chamar a Edge Function
`email-outbox-dispatch` via `pg_net`.

`EMAIL_OUTBOX_DISPATCH_SECRET` é necessário para autenticar o recovery interno.
`EMAIL_OUTBOX_TEST_FAILURE_SECRET` é exclusivo de homologação e não é usado
para criar ou processar lembretes em produção.

As actions são provisionadas inicialmente com despacho automático desativado.
Após a validação do ambiente, a ativação deve ser feita pela configuração
administrativa/operacional do ambiente, sem alterar migrations já aplicadas.

## Diagnóstico

Monitorar:

- `scheduled` e `processing` antigos;
- `missed` por indisponibilidade do cron;
- `failed` por erro de persistência/enqueue;
- `skipped` por configuração desativada ou estado inválido;
- `email_outbox` e `email_delivery_logs` para o resultado efetivo do provider.

Nenhuma consulta operacional deve imprimir valores de `.env`, headers de
autenticação ou credenciais.
