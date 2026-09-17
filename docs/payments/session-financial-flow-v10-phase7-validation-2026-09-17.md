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

## Reteste após o PR — persistência e reconciliação em HML

O PR manual posterior publicou a migration `20260917213000`. O novo dry-run
remoto retornou `upToDate: true`, sem alterações aplicadas pelo agente. Foram
baixados novamente o reconciliador e suas oito dependências, por API, em
diretório `.codex-*` ignorado: **9 correspondências, zero divergências** após
normalização apenas de finais de linha e espaços finais do arquivo.

A reconciliação do estado existente persistiu a primeira observação pendente:
`balanceAvailabilityKnown: true` e `balanceStatus: pending`. O observador
sanitizado confirmou pagamento pago, exatamente um Transfer registrado,
destino, valor e cobrança de origem corretos, uma tentativa paga e um webhook
processado uma vez, sem erro ou entregas pendentes. Não foi recriado Transfer.

O job ainda está `pending_source`, mas isso não representa ausência do repasse:
o pagamento e o Transfer já estão `transferred`. A leitura da Stripe Test
confirma disponibilidade do valor na conta conectada em
**23/09/2026 às 00:00 UTC (22/09 às 21h de Brasília)**. O observador bancário
retornou `waiting_transfer_availability`, zero alocações para esse Transfer e
zero Payouts automáticos posteriores à sua disponibilidade. A conta tem agenda
diária habilitada. Payouts históricos pagos não comprovam este canário.

No IAB, cliente e administrador foram recarregados no deploy HML atual:

- cliente: pagamento confirmado, independentemente da análise do atendimento;
- administrador: Transfer único de R$ 102,00, sem reembolso e botão de
  reembolso integral ativo; modal de R$ 120,00 exige motivo e foi fechado
  sem confirmar a operação;
- logs Postgres: ao atualizar às 19:12 de Brasília, o filtro de erros das últimas
  três horas ainda mostrava somente as cinco consultas `mgmt-api` incorretas
  documentadas acima; nenhum registro posterior ao das 17:07:09 foi observado.

O acompanhamento diário existente foi atualizado, sem criar automação
duplicada. Ele continua somente leitura, silencioso enquanto não houver mudança
relevante, e inclui o job deste encontro e o canário agendado de 15/09. Não
autoriza cobrança, Transfer, reembolso, deploy ou encerramento sem evidências.

## Gate SQL global — resolvido localmente

As execuções integrais, serializadas no Docker preservado, evoluíram de
35 arquivos com falha/aborto para 20, 8, 4 e finalmente **zero**. A primeira
execução verde teve `Files=163, Tests=3160, Result: PASS`. Após acrescentar três
assertions de regressão, a repetição terminou com
**`Files=163, Tests=3163, Result: PASS`**, em 33 segundos.

As correções desta rodada estão somente em testes, dois includes de fixtures e
este registro. Nenhum contrato da aplicação, migration, Function, política
financeira ou dado HML foi alterado para fazer os testes passarem.

Preparação e isolamento corrigidos:

- requisitos atuais de publicação (perfil, foto, conteúdo/guia e conta de
  recebimento) satisfeitos em fixtures transacionais, sem relaxar o predicado;
- disponibilidade de serviço explicitamente vinculada a `service_id`;
- horários históricos, criação efetiva da tentativa e entradas confiáveis de
  paciente/terapeuta alinhados, sem desligar proteções de tentativa ou época;
- cenários manuais isolados dos momentos em que o scheduler pode confirmar
  automaticamente o mesmo fixture;
- comandos de publicação testados com payload completo e perfil determinístico;
- chave de notificações e booking/request usados em contagens, não todo o
  histórico persistido no banco local;
- fixture captura o identificador de verificação antes de mudar para o papel
  autenticado; nenhuma permissão privada foi ampliada;
- apenas views pertencentes à extensão **pgTAP** ficam fora da auditoria de
  grants das views de aplicação; demais extensões e views continuam auditadas;
- o teste de consistência de configurações de serviço cobre o conjunto
  canônico do seed, não os serviços inseridos diretamente por testes manuais
  antigos. Isso não atesta esses dados manuais. Separadamente, a leitura HML
  observou 30 serviços ativos e **zero** sem configurações de reserva;
- a proteção de encerramento de sala reconhece tanto `pending` quanto
  `pending_admin_review`, como o contrato vigente exige.

Contratos antigos atualizados em `075`, `076`, `089`, `105`, `113` e `120`:

- avaliação privada de qualidade usa o contrato atual, vinculado à tentativa;
- opiniões diferentes não constituem divergência de presença;
- avaliação não substitui confirmação manual nem cria bloqueio financeiro;
- prazos operacionais de confirmação são sete dias para paciente e trinta
  para terapeuta, independentes do snapshot financeiro histórico;
- resposta pública ao solicitante atende a revisão privada; não recalcula
  pagamento ou Transfer;
- cobertura de compatibilidade financeira antiga permanece explícita, com
  pagamento legado e comando legado, sem atribuir esses efeitos à confirmação
  operacional atual ou à V10;
- auditoria histórica imutável, validação, idempotência, conflito de payload,
  autorização e privacidade continuam verificadas;
- assertion nova prova que o writer antigo falha fechado com
  `FEEDBACK_CONTRACT_VERSION_REQUIRED`;
- duas assertions novas comparam **todo o registro** do pagamento V10 antes e
  depois da avaliação negativa e da resposta TES: nenhum campo, flag de
  bloqueio ou metadata financeira foi alterado.

Todos os includes são carregados após `BEGIN`; os arquivos terminam com
`ROLLBACK`. O Docker permaneceu saudável, sem reset ou exclusão de volumes;
dry-run local retornou `upToDate: true`, cron local ativo permaneceu **zero** e
o lint validou **340 migrations com versões únicas**. Foram acompanhados CPU
dos containers e RAM antes/durante/depois das rodadas; havia aproximadamente
2,1–2,3 GiB livres nas repetições finais. Não foram executados build ou outras
cargas pesadas paralelas.

## Higiene e próximos gates atualizados

O `.gitignore` já cobre `.codex-*`. Foi encontrado um dump de diagnóstico
anterior já rastreado: `.codex-hml-public-schema.sql`. Ele foi retirado **somente
do índice Git**, mantendo a cópia local; a exclusão do versionamento está
preparada para o próximo PR manual. Nenhum outro arquivo foi staged, nenhum
commit, push ou PR foi realizado. A auditoria subsequente não encontrou outro
artefato `.codex-*` rastreado.

O gate da suíte SQL completa está fechado para esta revisão local. A Fase 7
**não** está fechada e a aprovação de produção continua pendente de:

1. confirmação do Payout relevante, alocação e reconciliação dos canários,
   após a disponibilidade real informada pela Stripe;
2. comprovação de drenagem segura das obrigações V9 remanescentes, sem
   conversão, duplicação ou perda;
3. observação de estabilização e fechamento dos demais critérios do plano,
   incluindo os ainda não comprovados; autorização de produção é separada.

Na leitura agregada V9 desta rodada foram observados 282 pagamentos legados:
107 cancelados, 24 reembolsados, três falhos e 148 marcados pagos. Destes pagos,
13 estão `transferred`; as outras **135 posições** estão em
`waiting_confirmation` (73), `blocked` (44), `eligible` (16), `failed` (uma) e
`waiting_settlement` (uma). Dessas 135, 134 têm identificadores de cobrança e
PaymentIntent preenchidos, e uma não tem esses vínculos. Isso é inventário de
estado HML, **não** validação individual dos objetos Stripe ou prova de dívida
efetiva: fixtures antigos precisam ser distinguidos de obrigações reais por
reconciliação. Não é seguro converter essas linhas para V10, apagar histórico,
remover bloqueios ou disparar 135 repasses com base somente nessa contagem.
Nenhuma dessas operações foi realizada; a drenagem V9 não foi declarada concluída.

Estas alterações de testes/documentação aguardam PR manual. Nenhum teste de
envio real de e-mail, novo reembolso ou novo evento Stripe foi necessário nesta
rodada. Produção permaneceu intocada.
