import { constantTimeEquals, hmacSha256Hex, sha256Hex } from "./crypto.ts";
import { ZoomError } from "./errors.ts";

export type ZoomWebhookBody = {
  event?: string;
  event_ts?: number;
  payload?: {
    account_id?: string;
    object?: Record<string, unknown>;
    plainToken?: string;
  };
};

export async function verifyZoomWebhookSignature(input: {
  body: string;
  secretToken: string;
  signature: string | null;
  timestamp: string | null;
  nowSeconds?: number;
}) {
  if (!input.signature || !input.timestamp) {
    throw new ZoomError(
      "zoom_webhook_signature_missing",
      400,
      "Webhook invalido.",
    );
  }

  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300) {
    throw new ZoomError("zoom_webhook_replay", 400, "Webhook expirado.");
  }

  const expected = `v0=${await hmacSha256Hex(
    input.secretToken,
    `v0:${input.timestamp}:${input.body}`,
  )}`;

  if (!(await constantTimeEquals(expected, input.signature))) {
    throw new ZoomError(
      "zoom_webhook_signature_invalid",
      400,
      "Webhook invalido.",
    );
  }
}

export async function createZoomChallengeResponse(
  plainToken: string,
  secretToken: string,
) {
  return {
    encryptedToken: await hmacSha256Hex(secretToken, plainToken),
    plainToken,
  };
}

export async function createZoomWebhookEventKey(input: {
  body: string;
  eventType: string;
  eventTs: number | null;
  meetingId: string | null;
  meetingUuid: string | null;
  participantId: string | null;
  requestId: string | null;
}) {
  return sha256Hex(
    [
      input.eventType,
      input.eventTs ?? "no-ts",
      input.meetingUuid ?? "no-uuid",
      input.meetingId ?? "no-id",
      input.participantId ?? "no-participant",
      input.requestId ?? "no-request",
      await sha256Hex(input.body),
    ].join(":"),
  );
}

export function normalizeZoomEventTime(eventTs: number | undefined) {
  if (!eventTs || !Number.isFinite(eventTs)) return new Date().toISOString();

  return new Date(
    eventTs > 9_999_999_999 ? eventTs : eventTs * 1000,
  ).toISOString();
}

export function getZoomWebhookObject(body: ZoomWebhookBody) {
  return body.payload?.object ?? {};
}
