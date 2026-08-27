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
import { ZoomVideoSdkApiClient } from "../_shared/zoom-video-sdk/api-client.ts";
import { getZoomVideoSdkConfig } from "../_shared/zoom-video-sdk/config.ts";
import { ZoomVideoSdkError } from "../_shared/zoom-video-sdk/errors.ts";
import { createVideoSdkJwt } from "../_shared/zoom-video-sdk/sdk-jwt.ts";
import {
  createVideoUserKey,
  sanitizeVideoDisplayName,
} from "../_shared/zoom-video-sdk/session-identity.ts";

type Body = {
  actorRole?: "patient" | "therapist";
  bookingId?: string;
  intent?: "end" | "join" | "preview";
};

type WaitingRoomArrivalResult = {
  entitled?: boolean;
};

type ManualEndAuthorization = {
  allowed?: boolean;
  alreadyEnded?: boolean;
  availableAt?: string;
  providerSessionId?: string | null;
  reason?: string;
  serverNow?: string;
  videoSessionId?: string | null;
};

const runtime = getPaymentsRuntime("zoom-video-session-access");
const ACCESS_TOKEN_RATE_LIMIT = {
  maxIssued: 4,
  windowSeconds: 60,
} as const;

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
    const requestedActorRole = body.actorRole;
    if (
      requestedActorRole !== undefined &&
      requestedActorRole !== "patient" &&
      requestedActorRole !== "therapist"
    ) {
      throw new DomainError(
        "invalid_video_actor_role",
        422,
        "Perfil de acesso invalido.",
      );
    }
    const intent = body.intent ?? "join";
    if (intent !== "join" && intent !== "preview" && intent !== "end") {
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
    if (requestedActorRole && requestedActorRole !== actor.role) {
      throw new DomainError(
        "role_mismatch",
        403,
        "Use a conta correta para acessar esta sessao.",
      );
    }
    const booking = await getAuthorizedVideoBooking({
      bookingId,
      client,
      environment: config.environment,
      profileId: actor.profile.id,
      role: actor.role,
    });

    if (intent === "end") {
      if (actor.role !== "therapist") {
        throw new DomainError(
          "FINAL_END_THERAPIST_REQUIRED",
          403,
          "Somente o terapeuta pode encerrar o encontro para todos.",
        );
      }

      return await endVideoSession({
        actorProfileId: actor.profile.id,
        bookingId,
        client,
        config,
        requestId,
        startedAt,
      });
    }

    let patientHasTimelyArrival = booking.patientHasTimelyArrival;
    if (actor.role === "patient") {
      const arrival = await client.rpc<WaitingRoomArrivalResult>(
        "record_patient_zoom_waiting_room_arrival_v1",
        {
          p_booking_id: bookingId,
          p_patient_profile_id: actor.profile.id,
        },
      );
      patientHasTimelyArrival =
        patientHasTimelyArrival || Boolean(arrival?.entitled);
    }
    const access = evaluateVideoSessionAccess({
      actorRole: actor.role,
      bookingStatus: booking.bookingStatus,
      endsAt: booking.endsAt,
      financialStatus: booking.financialStatus,
      hardEndsAt: booking.videoSession?.hardEndsAt ?? null,
      terminationRequestedAt:
        booking.videoSession?.terminationRequestedAt ?? null,
      terminationConfirmedAt:
        booking.videoSession?.terminationConfirmedAt ?? null,
      patientHasJoined: booking.patientHasJoined,
      patientHasTimelyArrival,
      startsAt: booking.startsAt,
      therapistStatus: booking.therapistStatus,
      therapistProfileEligible: booking.therapistProfileEligible,
      therapistPresent: booking.videoSession?.therapistPresent ?? false,
      videoSessionReady: Boolean(
        booking.videoSession &&
        ["ready", "active"].includes(booking.videoSession.status),
      ),
      videoSessionStatus: booking.videoSession?.status ?? null,
    });

    if (intent === "preview") {
      return withNoStore(success({ access, requestId }));
    }

    if (!access.allowed) {
      console.warn(
        JSON.stringify({
          actorRole: actor.role,
          code: "ZOOM_VIDEO_ACCESS_DENIED",
          durationMs: Date.now() - startedAt,
          intent,
          patientHasJoined: booking.patientHasJoined,
          patientHasTimelyArrival,
          reason: access.reason,
          requestId,
          therapistPresent: booking.videoSession?.therapistPresent ?? false,
        }),
      );
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
    await enforceAccessIssueRateLimit({
      bookingId,
      client,
      environment: config.environment,
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
        { therapist_token_issued_at: new Date().toISOString() },
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
        requestId,
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
      const { profile } = await requireTherapist(client, request, {
        requireReceivingAccount: true,
      });
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

async function enforceAccessIssueRateLimit(input: {
  bookingId: string;
  client: SupabaseRestClient;
  environment: string;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const reservation = await input.client.rpc<{
    allowed?: boolean;
    issuedCount?: number;
    resetAt?: string;
  }>("reserve_zoom_video_access_issue_v1", {
    p_actor_role: input.role,
    p_booking_id: input.bookingId,
    p_environment: input.environment,
    p_max_issued: ACCESS_TOKEN_RATE_LIMIT.maxIssued,
    p_profile_id: input.profileId,
    p_window_seconds: ACCESS_TOKEN_RATE_LIMIT.windowSeconds,
  });

  if (!reservation?.allowed) {
    throw new DomainError(
      "video_access_rate_limited",
      429,
      "Muitas tentativas de entrada. Aguarde alguns instantes.",
    );
  }
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

async function endVideoSession(input: {
  actorProfileId: string;
  bookingId: string;
  client: SupabaseRestClient;
  config: ReturnType<typeof getZoomVideoSdkConfig>;
  requestId: string;
  startedAt: number;
}) {
  const authorization = await input.client.rpc<ManualEndAuthorization>(
    "authorize_therapist_zoom_manual_end_v1",
    {
      p_booking_id: input.bookingId,
      p_therapist_profile_id: input.actorProfileId,
    },
  );

  if (!authorization?.allowed) {
    const reason = authorization?.reason ?? "VIDEO_SESSION_NOT_READY";
    const message =
      reason === "FINAL_END_TOO_EARLY"
        ? "O encerramento para todos ficará disponível nos 5 minutos finais."
        : reason === "TOO_LATE"
          ? "O horário programado do encontro terminou."
          : "Não foi possível encerrar o encontro agora.";

    console.warn(
      JSON.stringify({
        actorRole: "therapist",
        code: "ZOOM_VIDEO_FINAL_END_DENIED",
        durationMs: Date.now() - input.startedAt,
        reason,
        requestId: input.requestId,
      }),
    );

    return withNoStore(
      jsonResponse(
        {
          data: {
            availableAt: authorization?.availableAt ?? null,
            serverNow: authorization?.serverNow ?? new Date().toISOString(),
          },
          error: { code: reason, message, requestId: input.requestId },
          ok: false,
        },
        409,
      ),
    );
  }

  if (!authorization.alreadyEnded) {
    const providerSessionId = authorization.providerSessionId;
    const videoSessionId = authorization.videoSessionId;
    if (!providerSessionId || !videoSessionId) {
      throw new DomainError(
        "VIDEO_SESSION_NOT_READY",
        409,
        "Não foi possível encerrar o encontro agora.",
      );
    }

    const zoom = new ZoomVideoSdkApiClient({ config: input.config });
    try {
      await zoom.endSession(providerSessionId);
    } catch (error) {
      if (!(error instanceof ZoomVideoSdkError && error.status === 404)) {
        throw error;
      }
    }

    await input.client.rpc("mark_video_session_termination_confirmed_v1", {
      p_reason: "manual_end",
      p_video_session_id: videoSessionId,
    });
  }

  console.log(
    JSON.stringify({
      actorRole: "therapist",
      code: "ZOOM_VIDEO_FINAL_END_CONFIRMED",
      durationMs: Date.now() - input.startedAt,
      idempotentReplay: Boolean(authorization.alreadyEnded),
      requestId: input.requestId,
    }),
  );

  return withNoStore(
    success({
      ended: true,
      idempotentReplay: Boolean(authorization.alreadyEnded),
      serverNow: authorization.serverNow ?? new Date().toISOString(),
    }),
  );
}
