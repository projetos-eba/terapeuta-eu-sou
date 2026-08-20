# Plano de implementação do Manual de Comunicação Automatizada — TES

Data: 2026-08-20
Status: plano definitivo de discovery. Não autoriza implementação, migration, deploy, alteração Stripe, Zoom, scheduler ou envio real.

## Objetivo e limite

Implementar gradualmente os 39 cenários do Manual sobre a fundação existente, preservando:

- Hostinger Mail API e `sendTransactionalEmail()` como único mecanismo de entrega;
- registry, perfis de envio, overrides, sanitização, logs e RLS atuais;
- outbox transacional, snapshot no enqueue, retry seguro e recovery existentes;
- Auth, Stripe, agenda, verification, legal e LGPD como donos de seus estados autoritativos.

Não será criado um segundo sistema de e-mail, nem um scheduler baseado em processo web. Os dois e-mails de catálogo continuam como extensão de produto.

## Mudanças fundacionais propostas

### 1. Registry e renderer

Evoluir `EmailActionKey`, `emailActionRegistry` e `renderEmailTemplate()` de forma incremental para que cada nova ação declare:

- `actionKey`, categoria, label, descrição e persona;
- `currentTemplateVersion` e defaults editoriais do Manual;
- `preheader` como propriedade de template;
- allowlist de tokens e fixture fictícia;
- suporte ou não a disparo automático;
- contrato de destinatário resolvido pelo domínio.

Os defaults ficam no código. O banco continua apenas com configuração operacional e overrides. Auth inicialmente pode manter suas renderizações dedicadas, desde que adote o mesmo contrato de preheader, shell e copy; convergência posterior não deve reduzir garantias de token/expiração.

### 2. Generalização segura da outbox

A migration futura deve substituir a limitação atual de `email_outbox.related_entity_type = 'therapy_catalog_request'` por um contrato genérico com allowlist de entidades e enqueuers específicos do domínio. Não deve aceitar `action_key`, recipient ou payload arbitrário do browser.

Cada entrega lógica continuará única por:

`action_key + domain_event_id + recipient_key`

Onde `domain_event_id` é o evento autoritativo/imútavel (por exemplo: id de evento Stripe, `booking_events`, decisão de verification ou versão legal), e `recipient_key` é opaco (`profile:<uuid>` ou equivalente). Isso permite uma comunicação para paciente e outra para terapeuta sem colisão e evita depender somente de `correlation_id`.

O snapshot no enqueue deve permanecer: versão do default, overrides já sanitizados e perfil de envio. Evento desabilitado/automático desabilitado no momento do domínio não cria outbox; item pendente posteriormente desabilitado termina como `skipped`, sem retry ou reativação retroativa.

### 3. Owners de enqueue

O enqueue deve ocorrer na mesma transação da mudança autoritativa quando o owner for Postgres. Para Edge Functions/webhooks que hoje combinam vários passos, o lote deve criar um evento de domínio imutável ou chamar RPC transacional que persista domínio + outbox. Chamadas ao dispatcher só acontecem pós-commit e são best-effort; recovery por Cron é a rede de segurança.

Nunca enfileirar a partir de página, redirect de Checkout, webhook ainda não persistido ou polling visual.

### 4. Preheader e shell

Aplicar o [contrato de design](./email-design-contract.md): `preheader` no registry, renderização HTML oculta compatível, HTML/texto coerentes, CTA descritivo, assinatura e footer TES. Corrigir gradualmente “Ola”, “confirmacao” e “voce” somente no lote que tocar a respectiva cópia.

### 5. Scheduler de reminders

Os cenários 18 e 19 precisam de tabela/job de agenda persistente, não de `setTimeout`. O design a implementar deve:

- criar/remover/invalidar jobs junto de confirmação, cancelamento e reagendamento;
- armazenar somente referência a booking, versão, action e horário alvo;
- usar timezone do booking/destinatário e uma janela de tolerância documentada;
- confirmar no claim que booking continua `confirmed`, versão igual e início futuro;
- usar a outbox para dedupe/entrega; e
- ser acionado por mecanismo Supabase Cron/worker autorizado, com recovery e observabilidade.

## Lotes de implementação propostos

| Lote                               | Escopo                                                                                                               | Dependências e provas de aceite                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0 — Contrato comum                 | Preheader, shell incremental, tipos/registry escaláveis, generalização de outbox e enqueuers; sem todos os conteúdos | Unit/Deno/pgTAP para preheader, token allowlist, snapshot, dedupe multi-recipient/action, RLS e sanitização                   |
| 1 — Auth e cadastro                | Cenários 2–7; manter verificação/reset seguros e adicionar conclusão/boas-vindas/senha alterada                      | Token hash, expiração, reenvio, enumeração, idempotência e não bloqueio indevido de criação de conta                          |
| 2 — Ciclo do terapeuta             | Cenários 11–16                                                                                                       | Decisão administrativa persistida → outbox; nenhum documento/motivo sensível no e-mail                                        |
| 3 — Encontros                      | Cenários 17, 20–22 e infraestrutura dos lembretes 18–19                                                              | Estado `booking`/pagamento autoritativo, timezone, cancelamento/reagendamento, supressão de reminder e testes de concorrência |
| 4 — Financeiro                     | Cenários 23–28                                                                                                       | Webhook Stripe assinado/persistido, refund e payout reais, idempotência de webhook e conteúdo financeiro mínimo               |
| 5 — Assinaturas                    | Cenários 29–32                                                                                                       | `therapist_subscriptions`, invoices e eventos Stripe sincronizados; distinguir atualização imediata de downgrade futuro       |
| 6 — Produto e governança pendentes | Cenários 1, 8–10, 33–39                                                                                              | Decisões de produto abaixo; não implementar antes de estados/eventos legítimos                                                |
| 7 — Extensões                      | Revisar `therapy_catalog_request_*` para o novo shell e, se aprovado, atualizar o Manual                             | Não remover os pilotos existentes; confirmar compatibilidade de snapshot e logs                                               |

## Mapeamento de ações propostas

As chaves abaixo são propostas de registry, não entidades já criadas. Separar por persona quando subject/configuração/destino forem diferentes evita template híbrido e preserva dedupe multi-recipient.

| Domínio            | Action keys propostas                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro/Auth      | `registration_started`, `email_verification` (existente), `registration_completed`, `patient_welcome`, `therapist_welcome`, `password_reset` (existente), `password_changed`, `account_new_login`, `account_email_changed_old`, `account_email_changed_new`, `account_phone_changed`                                                                  |
| Verificação        | `therapist_profile_submitted_for_review`, `therapist_documents_requested`, `therapist_profile_approved`, `therapist_profile_rejected`, `therapist_profile_suspended`, `therapist_profile_reactivated`                                                                                                                                                 |
| Encontros          | `booking_confirmed_patient`, `booking_confirmed_therapist`, `booking_reminder_24h_patient`, `booking_reminder_24h_therapist`, `booking_reminder_1h_patient`, `booking_reminder_1h_therapist`, `booking_cancelled_patient`, `booking_cancelled_therapist`, `booking_rescheduled_patient`, `booking_rescheduled_therapist`, `booking_review_invitation` |
| Financeiro         | `session_payment_approved`, `session_payment_declined`, `session_payment_pending`, `session_refund_approved`, `session_refund_rejected`, `therapist_payout_completed`                                                                                                                                                                                 |
| Assinaturas        | `therapist_subscription_created`, `therapist_subscription_renewed`, `therapist_subscription_cancelled`, `therapist_subscription_plan_changed`                                                                                                                                                                                                         |
| Institucional/LGPD | `legal_terms_updated`, `legal_privacy_updated`, `planned_maintenance`, `institutional_announcement`, `lgpd_request_received`, `lgpd_request_completed`, `account_deletion_completed`                                                                                                                                                                  |

## Autoridade por integração de alto risco

| Integração             | Regra de implantação                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                   | E-mail de verificação/reset mantém token de uso único hasheado, rate limit e resposta não enumerável. Não deixar indisponibilidade de e-mail criar conta inconsistente sem decisão explícita do owner Auth. |
| Stripe/session payment | Enqueue somente após webhook assinado aplicar estado financeiro em `apply_session_payment_state_v1`; redirects e client polling são evidência de UX, não gatilho.                                           |
| Refund                 | Enqueue somente depois de resultado financeiro autoritativo; “aprovado” não pode antecipar crédito efetivo. Distinguir falha Stripe de negativa de política antes da copy final.                            |
| Assinaturas            | Usar eventos Stripe persistidos e `therapist_subscriptions`/invoice; não enviar cancelamento em pedido de cancelamento futuro.                                                                              |
| Booking                | Confirmar após estado persistido; cancelar/reagendar somente após RPC transacional; recipient e rotas por papel.                                                                                            |
| Reminders              | Jobs persistidos, timezone correto, cancelamento/reagendamento e janela idempotente.                                                                                                                        |
| Zoom                   | Sem URL, JWT ou segredo no e-mail. O e-mail só aponta para a área autenticada; Zoom não é autoridade de pagamento ou confirmação.                                                                           |

## Plano de teste por lote

- **Unit/Deno:** defaults, preheader, copy PT-BR, token allowlist, token desconhecido, escaping por contexto, URL oficial, sanitização, retry/classificação e snapshots.
- **pgTAP:** action definitions, grants/RLS, enqueuers por domínio, dedupe multi-action/multi-recipient, configuração desabilitada, snapshot, transições idempotentes, reminders inválidos por cancelamento/reagendamento e leases.
- **Webhooks:** replay de Stripe event, ordem fora de sequência, payment/refund/subscription duplicados e ausência de envio antes da persistência.
- **Playwright:** Admin pode configurar somente actions elegíveis; paciente/terapeuta/anônimo não acessam UI ou comando; preview é sandboxed e usa fixture; logs mascaram destinatário/erro.
- **HML:** somente após cada lote local passar e target explicitamente confirmado; fluxo real de domínio → outbox → dispatch → Hostinger → recebimento → log, sem dados sensíveis.

## Decisões de produto que permanecem abertas

1. Qual é o estado/TTL/consentimento de um cadastro iniciado para permitir retomada sem criar conta ou spam.
2. Política de segurança e privacidade para detecção de novo acesso: quais sinais, retenção, falsa positividade e localidade aproximada são aceitáveis.
3. Fluxo de alteração de e-mail (confirmação no endereço antigo/novo) e de telefone para cada persona, incluindo auditoria e tratamento de conta comprometida.
4. Janela operacional exata dos lembretes 24h/1h, timezone de referência e comportamento quando o encontro for criado já dentro dessas janelas.
5. Critério final do convite de avaliação: `booking.status=completed`, confirmação manual, telemetria Zoom ou combinação; e limite de reenvio.
6. Governança para publicar versões legais, manutenção e comunicados: owner, aprovação, audiência, agendamento e retenção de evidência.
7. Modelo de solicitações LGPD e exclusão: protocolo, área autenticada, SLA, base legal, retenção e endereço seguro para confirmação após anonimização.

## Critérios de saída da futura implementação

Um lote só avança após registrar: ação de domínio autoritativa, outbox atômica, dedupe, snapshot, destinatário resolvido server-side, template default/override, logs sanitizados, permissões, testes locais e, quando aplicável, recebimento HML controlado. A conclusão do catálogo não autoriza uma declaração de “Manual completo homologado” sem todos os 39 cenários e respectivas integrações externas.
