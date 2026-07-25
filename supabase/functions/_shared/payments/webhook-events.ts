import { SupabaseRestClient } from "../auth/supabase-rest.ts";

export type WebhookReservation = {
  acquired: boolean;
  processing_status:
    | "failed"
    | "ignored"
    | "processed"
    | "processing"
    | "received";
};

export async function reserveWebhookEvent(
  client: SupabaseRestClient,
  input: {
    accountId: string | null;
    apiVersion: string | null;
    eventCreatedAt: string;
    eventId: string;
    eventType: string;
    livemode: boolean;
    objectId: string | null;
    payloadSha256: string;
    source: "connect" | "platform";
  },
) {
  const rows = await client.rpc<WebhookReservation[]>(
    "reserve_stripe_webhook_event_v1",
    {
      p_account_id: input.accountId,
      p_api_version: input.apiVersion,
      p_event_created_at: input.eventCreatedAt,
      p_event_type: input.eventType,
      p_livemode: input.livemode,
      p_object_id: input.objectId,
      p_payload_sha256: input.payloadSha256,
      p_source: input.source,
      p_stripe_event_id: input.eventId,
    },
  );

  return rows[0];
}

export async function markWebhook(
  client: SupabaseRestClient,
  eventId: string,
  status: "failed" | "ignored" | "processed",
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
      processing_status: status,
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

export function eventCreatedAt(value: number | string | undefined) {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  throw new Error("STRIPE_EVENT_CREATED_AT_MISSING");
}

export function objectId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const id = (value as Record<string, unknown>).id;

  return typeof id === "string" ? id : null;
}

export async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
