import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { DomainError, failure, success } from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { getZoomConfig } from "../_shared/zoom/config.ts";
import { sanitizeProviderMessage, ZoomError } from "../_shared/zoom/errors.ts";
import {
  createZoomChallengeResponse,
  createZoomWebhookEventKey,
  getZoomWebhookObject,
  normalizeZoomEventTime,
  verifyZoomWebhookSignature,
  type ZoomWebhookBody,
} from "../_shared/zoom/webhook.ts";
import { sha256Hex } from "../_shared/zoom/crypto.ts";

const runtime = getPaymentsRuntime("zoom-webhook");
const MAX_WEBHOOK_BODY_BYTES = 128 * 1024;
const SUPPORTED_OPERATIONAL_EVENTS = new Set([
  "meeting.started",
  "meeting.started.v2",
  "meeting.ended",
  "meeting.ended.v2",
  "meeting.participant_joined",
  "meeting.participant_joined.v2",
  "meeting.participant_left",
  "meeting.participant_left.v2",
  "meeting.participant_admitted",
  "meeting.participant_admitted.v2",
  "meeting.participant_waiting",
  "meeting.participant_waiting.v2",
]);

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const config = getZoomConfig(runtime);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
      throw new DomainError(
        "zoom_webhook_payload_too_large",
        413,
        "Webhook muito grande.",
      );
    }

    await verifyZoomWebhookSignature({
      body: rawBody,
      secretToken: config.webhookSecretToken,
      signature: request.headers.get("x-zm-signature"),
      timestamp: request.headers.get("x-zm-request-timestamp"),
    });

    const body = parseWebhookBody(rawBody);

    if (body.event === "endpoint.url_validation") {
      const plainToken = body.payload?.plainToken;
      if (typeof plainToken !== "string" || !plainToken) {
        return new Response("Invalid validation payload", { status: 400 });
      }

      return success(
        await createZoomChallengeResponse(
          plainToken,
          config.webhookSecretToken,
        ),
      );
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Supabase configuration missing", { status: 503 });
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const object = getZoomWebhookObject(body);
    const eventType = body.event ?? "unknown";
    const eventTs = typeof body.event_ts === "number" ? body.event_ts : null;
    const meetingId = stringOrNull(object.id);
    const meetingUuid = stringOrNull(object.uuid);
    const participant =
      object.participant && typeof object.participant === "object"
        ? (object.participant as Record<string, unknown>)
        : {};
    const participantId =
      stringOrNull(participant.id) ?? stringOrNull(participant.user_id);
    const eventKey = await createZoomWebhookEventKey({
      body: rawBody,
      eventTs,
      eventType,
      meetingId,
      meetingUuid,
      participantId,
      requestId: request.headers.get("x-zm-request-id"),
    });
    const reservation = await client.rpc<
      Array<{ acquired: boolean; processing_status: string }>
    >("reserve_zoom_webhook_event_v1", {
      p_event_key: eventKey,
      p_event_ts: normalizeZoomEventTime(body.event_ts),
      p_event_type: eventType,
      p_payload_sanitized: {
        event: eventType,
        hasParticipant: Object.keys(participant).length > 0,
      },
      p_payload_sha256: await sha256Hex(rawBody),
      p_request_id: request.headers.get("x-zm-request-id"),
      p_zoom_account_identifier: body.payload?.account_id ?? null,
      p_zoom_meeting_id: meetingId,
      p_zoom_meeting_uuid: meetingUuid,
    });

    if (!reservation[0]?.acquired) {
      return success({
        duplicate: true,
        status: reservation[0]?.processing_status,
      });
    }

    try {
      if (!SUPPORTED_OPERATIONAL_EVENTS.has(eventType)) {
        await client.rpc("apply_zoom_webhook_transition_v1", {
          p_error_code: null,
          p_error_message: null,
          p_event_key: eventKey,
          p_status: "ignored",
        });

        return success({ ignored: true, received: true });
      }

      await client.rpc("apply_zoom_meeting_event_v1", {
        p_duration_seconds: numberOrNull(participant.duration),
        p_event_at: normalizeZoomEventTime(body.event_ts),
        p_event_type: eventType,
        p_participant_correlation_key:
          stringOrNull(participant.customer_key) ?? participantId,
        p_provider_user_id: stringOrNull(participant.user_id),
        p_zoom_meeting_id: meetingId,
        p_zoom_meeting_uuid: meetingUuid,
        p_zoom_participant_id: participantId,
        p_zoom_participant_uuid: stringOrNull(participant.participant_uuid),
      });
      await client.rpc("apply_zoom_webhook_transition_v1", {
        p_error_code: null,
        p_error_message: null,
        p_event_key: eventKey,
        p_status: "processed",
      });

      return success({ received: true });
    } catch (error) {
      await client.rpc("apply_zoom_webhook_transition_v1", {
        p_error_code: "zoom_webhook_processing_failed",
        p_error_message: sanitizeProviderMessage(error),
        p_event_key: eventKey,
        p_status: "failed",
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof ZoomError) {
      return failure(
        new DomainError(error.code, error.status, error.message),
        requestId,
      );
    }

    return failure(error, requestId);
  }
});

function stringOrNull(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);

  return null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseWebhookBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    throw new DomainError(
      "zoom_webhook_invalid_json",
      400,
      "Webhook invalido.",
    );
  }
}

export {};
