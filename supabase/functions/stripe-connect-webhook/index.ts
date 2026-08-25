import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  deriveConnectAccountState,
  derivePayoutSettingsState,
  getAccountId,
  retrieveAccountV2,
  retrieveBalanceSettings,
} from "../_shared/payments/connect.ts";
import { syncAutomaticStripePayout } from "../_shared/payments/automatic-payouts.ts";
import { failure, success } from "../_shared/payments/http.ts";
import { getPaymentsConfig, getPaymentsRuntime, getWebhookSecret } from "../_shared/payments/runtime.ts";
import { createStripeClient, TES_STRIPE_API_VERSION } from "../_shared/payments/stripe-client.ts";
import {
  eventCreatedAt,
  markWebhook,
  objectId,
  reserveWebhookEvent,
  sha256Hex,
} from "../_shared/payments/webhook-events.ts";

const PAYOUT_EVENTS = new Set([
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
]);
const runtime = getPaymentsRuntime("stripe-connect-webhook");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const stripe = createStripeClient(config.stripeApiKey);
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing Stripe signature", { status: 400 });

    const envelope = parseEnvelope(rawBody);
    const isThinEvent = envelope.object === "v2.core.event";
    const parsed = isThinEvent
      ? await stripe.parseEventNotificationAsync(rawBody, signature, getWebhookSecret(runtime, "STRIPE_CONNECT_V2_WEBHOOK_SECRET"))
      : await stripe.webhooks.constructEventAsync(rawBody, signature, getWebhookSecret(runtime, "STRIPE_CONNECT_WEBHOOK_SECRET"));
    const event = parsed as unknown as Record<string, unknown>;
    const eventId = String(event.id);
    const eventType = String(event.type);
    const eventTime = eventCreatedAt(event.created as number | string | undefined);
    const snapshot = isThinEvent ? null : asRecord(asRecord(event.data).object);
    const related = asRecord(event.related_object);
    const accountId = isThinEvent
      ? (stringOrNull(event.context) ?? stringOrNull(related.id))
      : (stringOrNull(event.account) ?? (PAYOUT_EVENTS.has(eventType) ? null : objectId(snapshot)));
    const reservation = await reserveWebhookEvent(client, {
      accountId,
      apiVersion: isThinEvent ? TES_STRIPE_API_VERSION : stringOrNull(event.api_version),
      eventCreatedAt: eventTime,
      eventId,
      eventType,
      livemode: event.livemode === true,
      objectId: objectId(snapshot) ?? accountId,
      payloadSha256: await sha256Hex(rawBody),
      source: "connect",
    });
    if (!reservation?.acquired) {
      return success({ duplicate: true, status: reservation?.processing_status ?? "processing" });
    }

    try {
      let handled = false;
      if (PAYOUT_EVENTS.has(eventType) && accountId && snapshot) {
        const payoutId = objectId(snapshot);
        if (payoutId) {
          const authoritative = await stripe.payouts.retrieve(payoutId, {}, { stripeContext: accountId });
          if (authoritative.automatic) {
            await syncAutomaticStripePayout({
              accountId,
              client,
              eventCreatedAt: eventTime,
              eventId,
              payout: authoritative,
              stripe,
              stripeMode: config.stripeMode,
            });
          } else {
            // Compatibility for already persisted/manual test Payouts. New BR
            // production flows never require TES metadata on the Payout.
            await client.rpc("apply_stripe_payout_state_v1", {
              p_arrival_at: authoritative.arrival_date
                ? new Date(authoritative.arrival_date * 1000).toISOString()
                : null,
              p_failure_code: authoritative.failure_code ?? null,
              p_failure_message: authoritative.failure_message ?? null,
              p_payout_batch_therapist_id: uuidOrNull(authoritative.metadata?.tes_payout_batch_therapist_id),
              p_provider_status: authoritative.status,
              p_stripe_account_id: accountId,
              p_stripe_event_created_at: eventTime,
              p_stripe_event_id: eventId,
              p_stripe_payout_id: authoritative.id,
            });
          }
          handled = true;
        }
      } else if (isAccountOrBalanceEvent(eventType) && accountId) {
        if (eventType === "v2.core.account.closed") {
          await disableClosedAccount(client, accountId, eventId, eventTime);
        } else {
          // Thin related objects don't include every capability projection by
          // default. Always retrieve the authoritative Account v2 snapshot
          // with the required includes so an out-of-order thin event can't
          // downgrade an operational account to an incomplete local state.
          const account = await retrieveAccountV2(config.stripeApiKey, accountId);
          await syncConnectAccount(client, stripe, account, eventId, eventTime);
        }
        handled = true;
      }

      await markWebhook(client, eventId, handled ? "processed" : "ignored");
      return success({ payloadStyle: isThinEvent ? "thin" : "snapshot", received: true });
    } catch (error) {
      await markWebhook(client, eventId, "failed", error instanceof Error ? error.message : "UNKNOWN");
      throw error;
    }
  } catch (error) {
    return failure(error, requestId);
  }
});

async function syncConnectAccount(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  account: Record<string, unknown>,
  eventId: string,
  eventTime: string,
) {
  const stripeAccountId = getAccountId(account);
  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/therapist_connect_accounts?select=id&stripe_account_id=eq.${encodeURIComponent(stripeAccountId)}&limit=1`,
  );
  if (!rows[0]) return;
  const balanceSettings = await retrieveBalanceSettings(stripe, stripeAccountId);
  const payoutSettings = derivePayoutSettingsState(balanceSettings as unknown as Record<string, unknown>);
  const state = deriveConnectAccountState(account, payoutSettings);
  await client.patch(`/rest/v1/therapist_connect_accounts?id=eq.${encodeURIComponent(rows[0].id)}`, {
    balance_settings_synced_at: new Date().toISOString(),
    charges_enabled: state.chargesEnabled,
    details_submitted: state.detailsSubmitted,
    disabled_reason: state.disabledReason,
    last_synced_at: new Date().toISOString(),
    onboarding_status: state.onboardingStatus,
    operational_status: state.operationalStatus,
    payout_schedule_interval: payoutSettings.interval,
    payout_status: payoutSettings.payoutStatus,
    payouts_enabled: payoutSettings.payoutsEnabled,
    pending_requirements: state.pendingRequirements,
    stripe_event_created_at: eventTime,
    stripe_event_id: eventId,
    stripe_transfers_status: state.transfersStatus,
  }, "return=minimal");
  await client.post("/rest/v1/therapist_connect_account_snapshots", {
    connect_account_id: rows[0].id,
    stripe_event_id: eventId,
    snapshot: {
      account_status: state.operationalStatus,
      onboarding_status: state.onboardingStatus,
      payout_schedule_interval: payoutSettings.interval,
      payout_status: payoutSettings.payoutStatus,
      transfers_status: state.transfersStatus,
    },
  }, "return=minimal");
}

async function disableClosedAccount(
  client: SupabaseRestClient,
  stripeAccountId: string,
  eventId: string,
  eventTime: string,
) {
  await client.patch(
    `/rest/v1/therapist_connect_accounts?stripe_account_id=eq.${encodeURIComponent(stripeAccountId)}`,
    {
      disabled_reason: "account_closed",
      charges_enabled: false,
      details_submitted: false,
      last_synced_at: new Date().toISOString(),
      onboarding_status: "disabled",
      operational_status: "disabled",
      payout_schedule_interval: null,
      payout_status: "disabled",
      payouts_enabled: false,
      stripe_event_created_at: eventTime,
      stripe_event_id: eventId,
      stripe_transfers_status: "inactive",
    },
    "return=minimal",
  );
}

function isAccountOrBalanceEvent(type: string) {
  return type === "account.updated" ||
    type === "balance_settings.updated" ||
    type === "account.external_account.updated" ||
    type.startsWith("v2.core.account");
}
function parseEnvelope(rawBody: string) {
  try { return asRecord(JSON.parse(rawBody)); } catch { return {}; }
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringOrNull(value: unknown) { return typeof value === "string" && value.length > 0 ? value : null; }
function uuidOrNull(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export {};
