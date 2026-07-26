import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  requireTherapist,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import {
  evaluateVideoSessionAccess,
  getVideoAccessMessage,
  type VideoAccessState,
} from "../_shared/zoom-video-sdk/access-policy.ts";
import { getAuthorizedVideoBooking } from "../_shared/zoom-video-sdk/booking-authorization.ts";
import { getZoomVideoSdkConfig } from "../_shared/zoom-video-sdk/config.ts";
import { ZoomVideoSdkError } from "../_shared/zoom-video-sdk/errors.ts";
import { createVideoSdkJwt } from "../_shared/zoom-video-sdk/sdk-jwt.ts";
import {
  createVideoUserKey,
  sanitizeVideoDisplayName,
} from "../_shared/zoom-video-sdk/session-identity.ts";

type Body = {
  bookingId?: string;
  intent?: "join" | "preview";
};

const runtime = getPaymentsRuntime("zoom-video-session-access");
const ACCESS_TOKEN_RATE_LIMIT = {
  maxIssued: 4,
  windowMs: 60_000,
} as const;
const accessIssueBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let bookingId: string | undefined;
  let actorRole: "patient" | "therapist" | undefined;

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const body = await parseJsonBody<Body>(request);
    bookingId = requireUuid(body.bookingId);
    const intent = body.intent ?? "join";
    if (intent !== "join" && intent !== "preview") {
      throw new DomainError(
        "invalid_video_access_intent",
        422,
        "Acao invalida.",
      );
    }

    const config = getZoomVideoSdkConfig(runtime);
    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const actor = await resolveActor(client, request);
    actorRole = actor.role;
    const booking = await getAuthorizedVideoBooking({
      bookingId,
      client,
      environment: config.environment,
      profileId: actor.profile.id,
      role: actor.role,
    });
    const access = evaluateVideoSessionAccess({
      actorRole: actor.role,
      bookingStatus: booking.bookingStatus,
      endsAt: booking.endsAt,
      financialStatus: booking.financialStatus,
      startsAt: booking.startsAt,
      therapistStatus: booking.therapistStatus,
      videoSessionReady: Boolean(
        booking.videoSession &&
        ["ready", "active"].includes(booking.videoSession.status),
      ),
      videoSessionStatus: booking.videoSession?.status ?? null,
    });

    if (intent === "preview") {
      return withNoStore(success({ access }));
    }

    if (!access.allowed) {
      return withNoStore(videoAccessFailure(access, requestId));
    }

    if (!booking.videoSession) {
      throw new DomainError(
        "video_session_not_ready",
        409,
        "A sala ainda esta em preparacao.",
      );
    }

    const roleType = actor.role === "therapist" ? 1 : 0;
    enforceAccessIssueRateLimit({
      bookingId,
      profileId: actor.profile.id,
      role: actor.role,
    });
    const userKey = await createVideoUserKey({
      bookingId,
      profileId: actor.profile.id,
      role: actor.role,
    });
    const token = await createVideoSdkJwt({
      config,
      roleType,
      sessionKey: booking.videoSession.sessionKey,
      sessionName: booking.videoSession.sessionName,
      userKey,
    });

    if (actor.role === "therapist") {
      await client.patch(
        `/rest/v1/video_sessions?id=eq.${encodeURIComponent(booking.videoSession.id)}`,
        { therapist_access_issued_at: new Date().toISOString() },
        "return=minimal",
      );
    }

    console.log(
      JSON.stringify({
        actorRole: actor.role,
        bookingId,
        code: "ZOOM_VIDEO_ACCESS_GRANTED",
        durationMs: Date.now() - startedAt,
        requestId,
      }),
    );

    return withNoStore(
      success({
        access,
        roleType,
        sdkKey: config.sdkKey,
        sessionName: booking.videoSession.sessionName,
        sessionPasscode: null,
        token,
        userName: actor.displayName,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        actorRole: actorRole ?? "unknown",
        bookingId,
        code:
          error instanceof DomainError
            ? error.code
            : error instanceof ZoomVideoSdkError
              ? error.code
              : "ZOOM_VIDEO_ACCESS_UNKNOWN",
        durationMs: Date.now() - startedAt,
        requestId,
      }),
    );

    return withNoStore(failure(toSafeVideoAccessError(error), requestId));
  }
});

async function resolveActor(client: SupabaseRestClient, request: Request) {
  const user = await requireUser(client, request);

  if (user.role === "therapist") {
    try {
      const { profile } = await requireTherapist(client, request);
      return {
        displayName: sanitizeVideoDisplayName(profile.public_name),
        profile,
        role: "therapist" as const,
      };
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.code === "therapist_financial_access_blocked"
      ) {
        throw new DomainError(
          "THERAPIST_SUSPENDED",
          403,
          "O acesso a sala esta bloqueado para este perfil.",
        );
      }
      throw error;
    }
  }

  if (user.role === "patient") {
    const { profile } = await requirePatient(client, request);
    return {
      displayName: sanitizeVideoDisplayName(profile.display_name),
      profile,
      role: "patient" as const,
    };
  }

  throw new DomainError("role_mismatch", 403, "Use uma conta participante.");
}

function videoAccessFailure(access: VideoAccessState, requestId: string) {
  const reason = access.reason ?? "UNKNOWN";
  return jsonResponse(
    {
      data: { access },
      error: {
        code: reason,
        message: getVideoAccessMessage(reason),
        requestId,
      },
      ok: false,
    },
    reason === "THERAPIST_NOT_ALLOWED" || reason === "THERAPIST_SUSPENDED"
      ? 403
      : 409,
  );
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError("invalid_booking_id", 422, "Sessao invalida.");
  }

  return value;
}

function enforceAccessIssueRateLimit(input: {
  bookingId: string;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const key = `${input.role}:${input.bookingId}:${input.profileId}`;
  const now = Date.now();
  const bucket = accessIssueBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    accessIssueBuckets.set(key, {
      count: 1,
      resetAt: now + ACCESS_TOKEN_RATE_LIMIT.windowMs,
    });
    return;
  }

  if (bucket.count >= ACCESS_TOKEN_RATE_LIMIT.maxIssued) {
    throw new DomainError(
      "video_access_rate_limited",
      429,
      "Muitas tentativas de entrada. Aguarde alguns instantes.",
    );
  }

  bucket.count += 1;
}

function toSafeVideoAccessError(error: unknown) {
  if (error instanceof DomainError) return error;
  if (error instanceof ZoomVideoSdkError) {
    return new DomainError(
      error.code,
      error.status,
      "Nao foi possivel abrir a sala agora.",
    );
  }

  return new DomainError(
    "internal_error",
    500,
    "Nao foi possivel abrir a sala agora.",
  );
}

function withNoStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export {};
