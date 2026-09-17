# Fase 7 — validação de 17 de setembro de 2026

Status: **aberta; não constitui aprovação para produção**.

Ambientes: Docker local e HML `emzwqkmrryuqvqiohqnu`, com Stripe Test.
Nenhuma migration ou Function nova foi publicada por esta validação. Nenhum
reembolso foi confirmado e nenhum teste de envio real de e-mail foi feito.

## PR publicado em HML

- Antes da correção local descrita abaixo, o dry-run remoto retornou
  `upToDate: true`, sem migrations pendentes.
- Foram baixados o reconciliador `reconcile-stripe-transfers` e suas oito
  dependências. Os nove arquivos correspondem ao código local, normalizando
  apenas finais de linha e espaços finais do arquivo.
- No IAB, após novo login e carregamento do deploy atual, o encontro
  `cf95afc2-8aeb-4e91-8461-4da6e427e334` mantém **Pagamento confirmado** enquanto
  o atendimento fica em análise. A tela não o apresenta mais como reservado
  nem informa que o pagamento está em análise.
- Na página administrativa do pagamento
  `15089f97-f2c0-4883-8c75-e35ba75be7e8`, a movimentação está registrada, há uma
  transferência de R$ 102,00 e o botão de reembolso integral está ativo.
  O modal foi aberto e fechado sem confirmar a operação.
- O observador somente leitura confirmou checkout completo e pago, uma única
  tentativa paga, webhook de sucesso processado sem erro e sem entregas
  pendentes na Stripe, e uma única transferência. Valor, destinatário e vínculo
  à cobrança de origem conferem entre HML e Stripe Test. A política V10 está
  ativa e a V9 inativa. O job associado permanece `pending_source`, enquanto o
  pagamento e a transferência estão registrados como `transferred`; isso
  exige acompanhamento da reconciliação, não autorização para repetir o repasse.
- A leitura de cron pelo schema REST não foi observável; os logs mostram
  execuções de cron, mas esta verificação não prova o resultado de cada worker.

## Erros 42703 enviados pelo usuário

As cinco consultas de diagnóstico anteriores usaram nomes incorretos de
colunas: `j.payment_id`, `closed_at`, `j.transfer_group`,
`reversed_amount_cents` e `stripe_transfer_id` na tabela `session_payments`.
São erros das consultas manuais realizadas pela API de gestão (`mgmt-api`),
não evidência de falha do aplicativo, cron ou webhook. As consultas eram
SELECTs e não alteraram os dados.

O painel de logs Postgres, filtrado por erro nas últimas três horas, apresentou
somente esses cinco registros; o último foi às 17:07:09 de Brasília. O filtro
da última hora retornou zero registros. Essa é uma observação pontual, não uma
garantia de ausência de erros futuros.

## Falha distinta encontrada: primeiro saldo pendente

A Stripe Test informa que a movimentação da cobrança está pendente, mas HML
mantém `stripe_balance_status`, `stripe_balance_available_on` e
`stripe_balance_checked_at` vazios, mesmo tendo o identificador da movimentação.

Causa: na função `record_session_payment_stripe_reconciliation_v2`, a expressão
`NOT (previous_status = 'available' AND incoming_status = 'pending')` resulta
em NULL quando o status anterior é NULL e a primeira observação é pendente.
O bloco de atualização não é executado.

Correção **somente local**:

- migration `20260917213000_fix_initial_pending_charge_settlement.sql`;
- comparação anterior null-safe por `IS NOT DISTINCT FROM 'available'`;
- preservação do bloqueio de regressão disponível → pendente, ordenação das
  observações e autorização exclusiva de service role;
- nenhuma introdução de prazo de segurança ou espera para Transfer V10.

O teste de regressão reproduziu três falhas antes da migration. Após a correção,
o arquivo `108_financial_settlement_and_hourly_reconciliation.sql` aprovou
37/37 verificações, incluindo primeiro pendente, evolução para disponível,
proteção contra regressão antiga e recente, e manutenção do pagamento pago e
do Transfer já concluído.

O Docker local ficou saudável e alinhado. Foram aplicadas também três
migrations já presentes no repositório que ainda estavam pendentes localmente:
`20260917170100`, `20260917180100` e `20260917200000`. O dry-run local subsequente
retornou `upToDate: true`. Os testes são transacionais com rollback.

## Gate global

A execução integral SQL terminou com `Files=163`, `Tests=2967`, `Result: FAIL`,
com falhas ou abortos em 35 arquivos. Esse resultado foi obtido antes das
quatro verificações adicionais do teste focado (que passou com 37/37).

Arquivos com falha: `003_agenda_a2_transactional_foundation`,
`009_therapy_service_foundation`, `011_therapist_profile_m1`,
`014_therapist_metrics_mtr1_mtr2`, `020_match_admin_operational_foundation`,
`033_admin_hardening_public_therapist_slug_redirects`,
`034_admin_hardening_public_therapy_catalog_invoker_views`,
`038_admin_hardening_public_therapist_profile_content_invoker`,
`040_admin_operation_commands`, `044_security_authorization_surface`,
`045_zoom_admin_session_hardening`, `049_therapist_publication_lifecycle`,
`057_therapist_public_profile_identity`, `075_session_feedback`,
`076_session_attendance_confirmation_lifecycle`,
`079_payment_failure_booking_release`, `080_public_search_next_slot`,
`086_public_therapist_services_and_themes`,
`087_fully_refunded_booking_slot_release`,
`089_bilateral_confirmation_and_relationship_reviews`,
`090_connect_account_closure_recovery`, `096_public_availability_horizon_90_days`,
`098_match_related_therapists_plan_tiebreak`,
`098_profile_post_approval_publication_and_document_lock`,
`100_zoom_patient_no_show_termination`,
`101_service_scoped_availability_and_global_occupancy`,
`104_therapy_theme_contract_recovery`,
`105_therapist_pending_confirmations_read_model`,
`108_agenda_calendar_operational_rail`,
`110_booking_reschedule_availability_notifications`,
`113_private_session_journey_themes`, `118_agenda_session_interval`,
`119_public_reservation_consistency`,
`120_session_financial_flow_v10_feedback_projection`,
`123_therapist_change_admin_review` (todos em `supabase/tests`, extensão `.sql`).

Não foi provada a causa individual dessas 35 falhas nesta validação. Algumas
envolvem fixtures que não satisfazem os contratos atuais; não se deve alterar
as regras de negócio ou reduzir assertions apenas para obter uma suíte verde.

## Próximos gates

1. PR manual da correção local e reteste da persistência pendente em HML.
2. Diagnóstico e correção das falhas SQL globais, preservando dados locais.
3. Completar os demais gates do plano: confirmação bancária dos canários,
   drenagem segura das obrigações V9 e estabilização observada.
4. Manter evidências explícitas dos cenários ainda não observados; não declarar
   aprovação de produção apenas pelo sucesso de checkout ou status de Function.

Nenhum novo evento Stripe é necessário para esta correção de persistência SQL.
