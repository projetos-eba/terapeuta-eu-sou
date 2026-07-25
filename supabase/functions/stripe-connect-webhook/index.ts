import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { failure, success } from "../_shared/payments/http.ts";
import {
  getPendingRequirements,
  getTransfersStatus,
} from "../_shared/payments/connect.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
  getWebhookSecret,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type WebhookEventRow = {
  id: string;
  processing_status:
    | "failed"
    | "ignored"
    | "processed"
    | "processing"
    | "received";
};

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

    if (!signature)
      return new Response("Missing Stripe signature", { status: 400 });

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      getWebhookSecret(runtime, "STRIPE_CONNECT_WEBHOOK_SECRET"),
    );
    const webhookRow = await reserveWebhookEvent(client, {
      accountId: event.account ?? null,
      apiVersion: event.api_version ?? null,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      payloadSha256: await sha256Hex(rawBody),
    });

    if (webhookRow.processing_status === "processed") {
      return success({ duplicate: true });
    }

    await markWebhook(client, event.id, "processing");

    try {
      if (event.type === "account.updated") {
        await handleAccountUpdated(
          client,
          event.id,
          event.data.object as unknown as Record<string, unknown>,
        );
        await markWebhook(client, event.id, "processed");
      } else {
        await markWebhook(client, event.id, "ignored");
      }
    } catch (error) {
      await markWebhook(
        client,
        event.id,
        "failed",
        error instanceof Error ? error.message : "UNKNOWN",
      );
      throw error;
    }

    return success({ received: true });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function handleAccountUpdated(
  client: SupabaseRestClient,
  eventId: string,
  account: Record<string, unknown>,
) {
  const stripeAccountId = String(account.id);
  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/therapist_connect_accounts?select=id&stripe_account_id=eq.${encodeURIComponent(
      stripeAccountId,
    )}&limit=1`,
  );

  if (!rows[0]) return;

  const transfersStatus = getTransfersStatus(account);
  const pending = getPendingRequirements(account);

  await client.patch(
    `/rest/v1/therapist_connect_accounts?id=eq.${encodeURIComponent(rows[0].id)}`,
    {
      last_synced_at: new Date().toISOString(),
      onboarding_status:
        transfersStatus === "active" ? "ready" : "requirements_due",
      operational_status:
        transfersStatus === "active" ? "ready" : "restricted",
      pending_requirements: pending,
      stripe_transfers_status: transfersStatus,
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

async function reserveWebhookEvent(
  client: SupabaseRestClient,
  input: {
    accountId: string | null;
    apiVersion: string | null;
    eventId: string;
    eventType: string;
    livemode: boolean;
    payloadSha256: string;
  },
) {
  const existing = await client.get<WebhookEventRow[]>(
    `/rest/v1/stripe_webhook_events?select=id,processing_status&stripe_event_id=eq.${encodeURIComponent(
      input.eventId,
    )}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const rows = await client.post<WebhookEventRow[]>(
    "/rest/v1/stripe_webhook_events?select=id,processing_status",
    {
      account_id: input.accountId,
      api_version: input.apiVersion,
      attempts: 1,
      event_type: input.eventType,
      livemode: input.livemode,
      payload_sha256: input.payloadSha256,
      processing_status: "received",
      source: "connect",
      stripe_event_id: input.eventId,
      updated_at: new Date().toISOString(),
    },
    "return=representation",
  );

  return rows[0];
}

async function markWebhook(
  client: SupabaseRestClient,
  eventId: string,
  status: "failed" | "ignored" | "processed" | "processing",
  errorMessage?: string,
) {
  await client.patch(
    `/rest/v1/stripe_webhook_events?stripe_event_id=eq.${encodeURIComponent(eventId)}`,
    {
      error_message: errorMessage?.slice(0, 500) ?? null,
      processed_at:
        status === "processed" || status === "ignored"
          ? new Date().toISOString()
          : null,
      processing_started_at:
        status === "processing" ? new Date().toISOString() : undefined,
      processing_status: status,
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export {};
