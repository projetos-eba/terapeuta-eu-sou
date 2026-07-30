import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  deriveConnectAccountState,
  getAccountId,
} from "../_shared/payments/connect.ts";
import { failure, success } from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
  getWebhookSecret,
} from "../_shared/payments/runtime.ts";
import {
  createStripeClient,
  TES_STRIPE_API_VERSION,
} from "../_shared/payments/stripe-client.ts";
import {
  eventCreatedAt,
  markWebhook,
  objectId,
  reserveWebhookEvent,
  sha256Hex,
} from "../_shared/payments/webhook-events.ts";

const runtime = getPaymentsRuntime("stripe-connect-webhook");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    const envelope = parseEnvelope(rawBody);
    const isThinEvent = envelope.object === "v2.core.event";
    const parsed = isThinEvent
      ? await stripe.parseEventNotificationAsync(
          rawBody,
          signature,
          getWebhookSecret(runtime, "STRIPE_CONNECT_V2_WEBHOOK_SECRET"),
        )
      : await stripe.webhooks.constructEventAsync(
          rawBody,
          signature,
          getWebhookSecret(runtime, "STRIPE_CONNECT_WEBHOOK_SECRET"),
        );
    const event = parsed as unknown as Record<string, unknown>;
    const eventId = String(event.id);
    const eventType = String(event.type);
    const eventTime = eventCreatedAt(
      event.created as number | string | undefined,
    );
    const snapshotObject = isThinEvent
      ? null
      : asRecord(asRecord(event.data).object);
    const relatedObject = asRecord(event.related_object);
    const accountId = isThinEvent
      ? stringOrNull(relatedObject.id)
      : (stringOrNull(event.account) ?? objectId(snapshotObject));
    const reservation = await reserveWebhookEvent(client, {
      accountId,
      apiVersion: isThinEvent
        ? TES_STRIPE_API_VERSION
        : stringOrNull(event.api_version),
      eventCreatedAt: eventTime,
      eventId,
      eventType,
      livemode: event.livemode === true,
      objectId: accountId,
      payloadSha256: await sha256Hex(rawBody),
      source: "connect",
    });

    if (!reservation?.acquired) {
      return success({
        duplicate: true,
        status: reservation?.processing_status ?? "processing",
      });
    }

    try {
      const handled = isAccountEvent(eventType);
      if (handled) {
        if (eventType === "v2.core.account.closed" && accountId) {
          await disableClosedAccount(client, accountId, eventId, eventTime);
        } else {
          const account = isThinEvent
            ? asRecord(
                await (
                  parsed as unknown as {
                    fetchRelatedObject: () => Promise<unknown>;
                  }
                ).fetchRelatedObject(),
              )
            : snapshotObject;

          if (account) {
            await syncConnectAccount(client, account, eventId, eventTime);
          }
        }
      }

      await markWebhook(client, eventId, handled ? "processed" : "ignored");
      return success({
        payloadStyle: isThinEvent ? "thin" : "snapshot",
        received: true,
      });
    } catch (error) {
      await markWebhook(
        client,
        eventId,
        "failed",
        error instanceof Error ? error.message : "UNKNOWN",
      );
      throw error;
    }
  } catch (error) {
    return failure(error, requestId);
  }
});

async function syncConnectAccount(
  client: SupabaseRestClient,
  account: Record<string, unknown>,
  eventId: string,
  eventTime: string,
) {
  const stripeAccountId = getAccountId(account);
  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/therapist_connect_accounts?select=id&stripe_account_id=eq.${encodeURIComponent(
      stripeAccountId,
    )}&limit=1`,
  );

  if (!rows[0]) return;

  const state = deriveConnectAccountState(account);
  await client.patch(
    `/rest/v1/therapist_connect_accounts?id=eq.${encodeURIComponent(rows[0].id)}`,
    {
      charges_enabled: state.chargesEnabled,
      details_submitted: state.detailsSubmitted,
      disabled_reason: state.disabledReason,
      last_synced_at: new Date().toISOString(),
      onboarding_status: state.onboardingStatus,
      operational_status: state.operationalStatus,
      pending_requirements: state.pendingRequirements,
      payouts_enabled: state.payoutsEnabled,
      stripe_event_created_at: eventTime,
      stripe_event_id: eventId,
      stripe_transfers_status: state.transfersStatus,
    },
    "return=minimal",
  );
  await client.post(
    "/rest/v1/therapist_connect_account_snapshots",
    {
      connect_account_id: rows[0].id,
      stripe_event_id: eventId,
      snapshot: account,
    },
    "return=minimal",
  );
}

async function disableClosedAccount(
  client: SupabaseRestClient,
  stripeAccountId: string,
  eventId: string,
  eventTime: string,
) {
  await client.patch(
    `/rest/v1/therapist_connect_accounts?stripe_account_id=eq.${encodeURIComponent(
      stripeAccountId,
    )}`,
    {
      disabled_reason: "account_closed",
      charges_enabled: false,
      details_submitted: false,
      last_synced_at: new Date().toISOString(),
      onboarding_status: "disabled",
      operational_status: "disabled",
      payouts_enabled: false,
      stripe_event_created_at: eventTime,
      stripe_event_id: eventId,
      stripe_transfers_status: "inactive",
    },
    "return=minimal",
  );
}

function isAccountEvent(eventType: string) {
  return (
    eventType === "account.updated" || eventType.startsWith("v2.core.account")
  );
}

function parseEnvelope(rawBody: string) {
  try {
    return asRecord(JSON.parse(rawBody));
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export {};
