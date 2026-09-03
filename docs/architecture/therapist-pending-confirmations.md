# Read model de confirmações pendentes do terapeuta

Atualizado em 2026-09-03.

## Contrato

`public.get_therapist_pending_confirmations_v1()` é um read model server-side,
consumido pelo serviço de Sessões e pelo dashboard. O retorno versionado é:

```ts
type TherapistPendingConfirmationsSummary = {
  generatedAt: string;
  pendingBookingIds: string[];
  pendingCount: number;
  therapistProfileId: string;
  version: 1;
};
```

O RPC deriva o terapeuta de `auth.uid()`, bloqueia perfis suspensos/rejeitados e
não expõe o helper de linhas ao papel `authenticated`. O serviço Next valida o
perfil retornado antes de disponibilizar o resultado ao shell.

## Regra operacional

Uma sessão entra no conjunto quando:

- terminou (`bookings.ends_at <= now()`);
- não está cancelada ou reembolsada;
- tem pagamento `paid` ou `partially_refunded`;
- está em `scheduled` ou `occurred_pending_confirmation`;
- ainda não tem `service_confirmed_at`, registro de confirmação do terapeuta
  (`session_participant_confirmations`/feedback) ou bloqueio
  financeiro/administrativo.

Sessões confirmadas, canceladas, reembolsadas, contestadas, bloqueadas e com
confirmação automática ficam fora do conjunto. A mesma regra alimenta o campo
`pendingConfirmations` da página de Avaliações, evitando contagens divergentes.

## Superfícies

- Dashboard: adiciona “Confirmações pendentes” apenas quando `pendingCount > 0`.
- Free: `/terapeuta/sessoes?period=all#pending-confirmations`.
- Premium/Premium Plus: `/terapeuta/avaliacoes?tab=session#pending-session-confirmations`.
- Sessões: aplica “Aguardando confirmação” somente aos IDs do read model, em
  tabela desktop e lista mobile. Se a leitura falha, o estado transacional
  continua visível sem badge inventado.

A migration e o teste pgTAP são, respectivamente,
`20260903010000_therapist_pending_confirmations_read_model.sql` e
`105_therapist_pending_confirmations_read_model.sql`. Os RPCs e migrations
existentes permanecem preservados.
