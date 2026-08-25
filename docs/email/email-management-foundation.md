# Fundação de gerenciamento de e-mails

## Escopo da Fase 1

O TES usa Hostinger Mail API exclusivamente em Edge Functions. Os templates
oficiais permanecem versionados em código; `email_action_settings` armazena
somente o estado operacional e overrides opcionais.

Os primeiros eventos configuráveis são `therapy_catalog_request_submitted` e
`therapy_catalog_request_updated`. Destinatário e dados dinâmicos são sempre
resolvidos pelo evento; o Admin não informa e-mail de destino.

## Segurança

- Tokens seguem allowlist por evento e valores desconhecidos falham fechados.
- Preview usa fixture fictícia e HTML sanitizado em iframe sandboxed.
- `anon` não acessa as tabelas de e-mail; `authenticated` só tem leitura
  sujeita a RLS administrativa. Mutação acontece somente na Edge Function.
- Logs mascaram destinatários e truncam erros. Corpos, segredos e credenciais
  não são persistidos no histórico administrativo.

## Limites

## Evolução da Fase 2

`email_outbox` recebe referências mínimas na mesma transação dos eventos de
catálogo. A entrega lógica é identificada por `action_key`, evento de domínio
e uma chave opaca do destinatário, permitindo diferentes comunicações do mesmo
evento sem colisão. O snapshot captura versão do template, overrides e perfil
de envio no enqueue; mudanças administrativas só valem para novas entregas.

`email-outbox-dispatch` faz claim com `SKIP LOCKED`, resolve o destinatário
server-side e aplica retry exponencial limitado a cinco tentativas apenas
quando o provider respondeu que não aceitou a entrega. Falha de rede, timeout
ou lease vencido vira revisão operacional, sem reenvio silencioso. O fluxo de
negócio não espera nem faz rollback por indisponibilidade do provider.
Entregas em processamento ou estado terminal não mantêm `next_attempt_at`;
somente itens `pending` ou `retry_pending` possuem agendamento futuro.

Os comandos piloto solicitam dispatch best-effort depois do commit. Um job
Supabase Cron chama a mesma função a cada minuto via `pg_net`; URL e segredo
do dispatcher ficam no Vault. Esse recovery também cobre restart e falha do
primeiro dispatch.

O hook de falha é exclusivamente HML, one-shot, com validade máxima de dez
minutos e segredo próprio. Ele nunca cria evento, outbox ou log artificial.

O scheduler de lembretes de encontros é separado do recovery da outbox. O job
`tes-booking-reminders-v1` roda a cada minuto no Postgres, processa somente
`booking_reminder_24h_patient` e `booking_reminder_1h_patient`, e grava o
resultado em `booking_reminder_jobs`. Ele nunca chama o provider diretamente:
apenas cria uma entrega transacional no `email_outbox`. O claim revalida status
confirmado, pagamento elegível, versão da reserva e início futuro. Cancelamento
ou reagendamento invalida jobs pendentes; lembretes fora do ciclo estrito do
cron são marcados como `missed`, sem catch-up.

Envio manual e novos gatilhos de domínio continuam fora do piloto.

## Configuração operacional HML

Antes de habilitar recovery, configurar no secret manager remoto, sem registrar
valores no repositório: `EMAIL_OUTBOX_DISPATCH_SECRET` na Edge Function e no
Vault como `email_outbox_dispatch_secret`; URL canônica da função como
`email_outbox_dispatch_url`; e `EMAIL_OUTBOX_TEST_FAILURE_SECRET` somente em
HML. Produção não recebe o segredo nem aceita o hook de teste.
