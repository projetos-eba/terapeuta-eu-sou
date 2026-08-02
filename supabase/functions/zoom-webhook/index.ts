import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { jsonResponse } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { DomainError, failure, success } from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getZoomVideoSdkConfig } from "../_shared/zoom-video-sdk/config.ts";
import {
  sanitizeProviderMessage,
  ZoomVideoSdkError,
} from "../_shared/zoom-video-sdk/errors.ts";
import { sha256Hex } from "../_shared/zoom-video-sdk/crypto.ts";
import {
  createZoomVideoChallengeResponse,
  createZoomVideoWebhookEventKey,
  extractVideoParticipant,
  extractVideoSessionId,
  extractVideoSessionName,
  getZoomVideoWebhookObject,
  normalizeZoomVideoEventTime,
  numberOrNull,
  stringOrNull,
  verifyZoomVideoWebhookSignature,
  type ZoomVideoWebhookBody,
} from "../_shared/zoom-video-sdk/webhook.ts";

const runtime = getPaymentsRuntime("zoom-webhook");
const MAX_WEBHOOK_BODY_BYTES = 128 * 1024;
const SUPPORTED_EVENTS = new Set([
  "session.started",
  "session.ended",
  "session.user_joined",
  "session.user_left",
]);

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const config = getZoomVideoSdkConfig(runtime);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
      throw new DomainError(
        "zoom_webhook_payload_too_large",
        413,
        "Webhook muito grande.",
      );
    }

    await verifyZoomVideoWebhookSignature({
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

      return jsonResponse(
        await createZoomVideoChallengeResponse(
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
    const object = getZoomVideoWebhookObject(body);
    const participant = extractVideoParticipant(object);
    const eventType = body.event ?? "unknown";
    const eventTs = typeof body.event_ts === "number" ? body.event_ts : null;
    const sessionName = extractVideoSessionName(object);
    const providerSessionId = extractVideoSessionId(object);
    const providerUserId =
      stringOrNull(participant.id) ?? stringOrNull(participant.user_id);
    const providerUserKey =
      stringOrNull(participant.user_key) ??
      stringOrNull(participant.userKey) ??
      stringOrNull(participant.customer_key);
    const eventKey = await createZoomVideoWebhookEventKey({
      body: rawBody,
      eventTs,
      eventType,
      providerSessionId,
      providerUserId,
      providerUserKey,
      requestId: request.headers.get("x-zm-request-id"),
      sessionName,
    });
    const reservation = await client.rpc<
      Array<{ acquired: boolean; processing_status: string }>
    >("reserve_zoom_video_webhook_event_v1", {
      p_account_identifier: stringOrNull(body.payload?.account_id),
      p_event_key: eventKey,
      p_event_ts: normalizeZoomVideoEventTime(body.event_ts),
      p_event_type: eventType,
      p_payload_sanitized: {
        event: eventType,
        hasParticipant: Object.keys(participant).length > 0,
        hasSessionName: Boolean(sessionName),
      },
      p_payload_sha256: await sha256Hex(rawBody),
      p_provider_session_id: providerSessionId,
      p_provider_user_id: providerUserId,
      p_provider_user_key: providerUserKey,
      p_request_id: request.headers.get("x-zm-request-id"),
      p_session_name_hash: sessionName ? await sha256Hex(sessionName) : null,
    });

    if (!reservation[0]?.acquired) {
      return success({
        duplicate: true,
        status: reservation[0]?.processing_status,
      });
    }

    try {
      if (!SUPPORTED_EVENTS.has(eventType) || !sessionName) {
        await client.rpc("apply_zoom_video_webhook_transition_v1", {
          p_error_code: null,
          p_error_message: null,
          p_event_key: eventKey,
          p_status: "ignored",
        });

        return success({ ignored: true, received: true });
      }

      await client.rpc("apply_zoom_video_session_event_v1", {
        p_duration_seconds:
          numberOrNull(participant.duration) ??
          numberOrNull(participant.duration_seconds),
        p_after_ends_minutes: 30,
        p_event_at: normalizeZoomVideoEventTime(body.event_ts),
        p_event_type: eventType,
        p_max_duration_minutes: config.lifecycle.maxDurationMinutes,
        p_provider_session_id: providerSessionId,
        p_provider_user_id: providerUserId,
        p_provider_user_key: providerUserKey,
        p_session_name: sessionName,
      });
      await client.rpc("apply_zoom_video_webhook_transition_v1", {
        p_error_code: null,
        p_error_message: null,
        p_event_key: eventKey,
        p_status: "processed",
      });

      return success({ received: true });
    } catch (error) {
      await client.rpc("apply_zoom_video_webhook_transition_v1", {
        p_error_code: "zoom_video_webhook_processing_failed",
        p_error_message: sanitizeProviderMessage(error),
        p_event_key: eventKey,
        p_status: "failed",
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof ZoomVideoSdkError) {
      return failure(
        new DomainError(error.code, error.status, error.message),
        requestId,
      );
    }

    return failure(error, requestId);
  }
});

function parseWebhookBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as ZoomVideoWebhookBody;
  } catch {
    throw new DomainError(
      "zoom_webhook_invalid_json",
      400,
      "Webhook invalido.",
    );
  }
}

export {};
