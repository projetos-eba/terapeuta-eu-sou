import { constantTimeEquals, hmacSha256Hex, sha256Hex } from "./crypto.ts";
import { ZoomVideoSdkError } from "./errors.ts";

export type ZoomVideoWebhookBody = {
  event?: string;
  event_ts?: number;
  payload?: Record<string, unknown>;
};

const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;

export async function verifyZoomVideoWebhookSignature(input: {
  body: string;
  secretToken: string;
  signature: string | null;
  timestamp: string | null;
}) {
  if (!input.signature || !input.timestamp) {
    throw new ZoomVideoSdkError(
      "zoom_webhook_signature_missing",
      400,
      "Assinatura do webhook ausente.",
    );
  }

  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new ZoomVideoSdkError(
      "zoom_webhook_timestamp_invalid",
      400,
      "Timestamp do webhook invalido.",
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_DRIFT_SECONDS) {
    throw new ZoomVideoSdkError(
      "zoom_webhook_timestamp_expired",
      400,
      "Timestamp do webhook expirado.",
    );
  }

  const message = `v0:${input.timestamp}:${input.body}`;
  const digest = await hmacSha256Hex(input.secretToken, message);
  const expected = `v0=${digest}`;

  if (!(await constantTimeEquals(expected, input.signature))) {
    throw new ZoomVideoSdkError(
      "zoom_webhook_signature_invalid",
      400,
      "Assinatura do webhook invalida.",
    );
  }
}

export async function createZoomVideoChallengeResponse(
  plainToken: string,
  secretToken: string,
) {
  return {
    encryptedToken: await hmacSha256Hex(secretToken, plainToken),
    plainToken,
  };
}

export async function createZoomVideoWebhookEventKey(input: {
  body: string;
  eventTs: number | null;
  eventType: string;
  providerSessionId: string | null;
  providerUserId: string | null;
  providerUserKey: string | null;
  requestId: string | null;
  sessionName: string | null;
}) {
  return sha256Hex(
    [
      input.eventType,
      input.eventTs ?? "no-ts",
      input.providerSessionId ?? "no-provider-session",
      input.sessionName ?? "no-session-name",
      input.providerUserId ?? "no-provider-user",
      input.providerUserKey ?? "no-provider-user-key",
      input.requestId ?? "no-request",
      await sha256Hex(input.body),
    ].join(":"),
  );
}

export function normalizeZoomVideoEventTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }

  return new Date().toISOString();
}

export function getZoomVideoWebhookObject(body: ZoomVideoWebhookBody) {
  const payload = body.payload ?? {};
  const object = payload.object;

  return object && typeof object === "object" && !Array.isArray(object)
    ? (object as Record<string, unknown>)
    : payload;
}

export function extractVideoSessionName(object: Record<string, unknown>) {
  return (
    stringOrNull(object.session_name) ??
    stringOrNull(object.sessionName) ??
    stringOrNull(object.topic) ??
    stringOrNull(object.name)
  );
}

export function extractVideoSessionId(object: Record<string, unknown>) {
  return (
    stringOrNull(object.session_id) ??
    stringOrNull(object.sessionId) ??
    stringOrNull(object.id)
  );
}

export function extractVideoParticipant(object: Record<string, unknown>) {
  const participant = object.participant ?? object.user;
  return participant &&
    typeof participant === "object" &&
    !Array.isArray(participant)
    ? (participant as Record<string, unknown>)
    : {};
}

export function stringOrNull(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return null;
}

export function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
