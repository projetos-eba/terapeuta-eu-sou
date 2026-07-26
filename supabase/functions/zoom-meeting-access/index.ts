import { handleOptions } from "../_shared/auth/cors.ts";
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
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  getAuthorizedZoomBooking,
  sanitizeZoomDisplayName,
} from "../_shared/zoom/booking-authorization.ts";
import {
  evaluateZoomAccess,
  getZoomAccessMessage,
  type ZoomAccessState,
} from "../_shared/zoom/access-policy.ts";
import { jsonResponse } from "../_shared/auth/cors.ts";
import { getZoomConfig } from "../_shared/zoom/config.ts";
import { hmacSha256Hex } from "../_shared/zoom/crypto.ts";
import {
  createMeetingSdkJwt,
  normalizeMeetingSdkRole,
} from "../_shared/zoom/meeting-sdk-jwt.ts";
import { getZoomMeeting } from "../_shared/zoom/meetings.ts";
import { requireUuid } from "../_shared/zoom/schemas.ts";
import { getZoomZak } from "../_shared/zoom/zak.ts";
import { logZoomOperation } from "../_shared/zoom/observability.ts";
import { ZoomError } from "../_shared/zoom/errors.ts";

type Body = {
  bookingId?: string;
  intent?: "join" | "preview";
};

type ZoomMeetingRow = {
  id: string;
  booking_id: string;
  duration_minutes: number;
  scheduled_ends_at: string;
  scheduled_starts_at: string;
  status: string;
  zoom_host_user_id: string;
  zoom_meeting_id: string | null;
};

const runtime = getPaymentsRuntime("zoom-meeting-access");

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
      throw new DomainError("invalid_zoom_access_intent", 422, "Ação inválida.");
    }
    const config = getZoomConfig(runtime);
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
    const booking = await getAuthorizedZoomBooking({
      bookingId,
      client,
      profileId: actor.profile.id,
      role: actor.role,
    });

    const [localMeeting] = await client.get<ZoomMeetingRow[]>(
      `/rest/v1/zoom_meetings?select=id,booking_id,zoom_meeting_id,zoom_host_user_id,scheduled_starts_at,scheduled_ends_at,duration_minutes,status&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
    );
    const access = evaluateZoomAccess({
      actorOwnsBooking: true,
      actorRole: actor.role,
      bookingStatus: booking.status,
      endsAt: booking.ends_at,
      financialStatus: booking.financial_status,
      meetingReady: Boolean(
        localMeeting?.zoom_meeting_id &&
          ["provisioned", "scheduled", "in_progress"].includes(
            localMeeting.status,
          ),
      ),
      meetingStatus: localMeeting?.status ?? null,
      startsAt: booking.starts_at,
      therapistStatus:
        actor.role === "therapist" ? actor.profile.status : undefined,
    });

    if (intent === "preview") {
      return success({ access });
    }

    if (!access.allowed) {
      return zoomAccessFailure(access, requestId);
    }

    if (!localMeeting?.zoom_meeting_id) {
      throw new DomainError(
        "MEETING_NOT_READY",
        409,
        "A sala ainda está em preparação.",
      );
    }
    const providerMeeting = await getZoomMeeting(
      config,
      localMeeting.zoom_meeting_id,
    );
    const role = normalizeMeetingSdkRole(actor.role);
    const [signature, customerKey, zak] = await Promise.all([
      createMeetingSdkJwt({
        config,
        meetingNumber: String(providerMeeting.id),
        role,
      }),
      createCustomerKey(
        config.webhookSecretToken,
        bookingId,
        actor.profile.id,
        actor.role,
      ),
      actor.role === "therapist"
        ? getZoomZak(config, localMeeting.zoom_host_user_id)
        : Promise.resolve(null),
    ]);

    if (actor.role === "therapist" && !zak) {
      throw new DomainError(
        "zoom_zak_unavailable",
        409,
        "Nao foi possivel iniciar a sala como anfitriao agora.",
      );
    }

    const meeting = {
      customerKey,
      meetingNumber: String(providerMeeting.id),
      passWord: providerMeeting.password ?? "",
      role,
      sdkKey: config.meetingSdkClientId,
      signature,
      userName: actor.displayName,
      zak: zak ?? undefined,
    };

    logZoomOperation("info", {
      actorRole: actor.role,
      bookingId,
      code: "ZOOM_ACCESS_GRANTED",
      durationMs: Date.now() - startedAt,
      operation: "zoom_meeting_access",
      requestId,
    });

    return success({
      access,
      meeting,
      ...meeting,
    });
  } catch (error) {
    logZoomOperation("error", {
      actorRole: actorRole ?? "unknown",
      bookingId,
      code:
        error instanceof DomainError
          ? error.code
          : error instanceof ZoomError
            ? error.code
            : "ZOOM_ACCESS_UNKNOWN",
      durationMs: Date.now() - startedAt,
      operation: "zoom_meeting_access",
      requestId,
      status:
        error instanceof DomainError || error instanceof ZoomError
          ? error.status
          : 500,
    });
    return failure(toSafeZoomAccessError(error), requestId);
  }
});

async function resolveActor(client: SupabaseRestClient, request: Request) {
  const user = await requireUser(client, request);

  if (user.role === "therapist") {
    try {
      const { profile } = await requireTherapist(client, request);
      return {
        displayName: sanitizeZoomDisplayName(profile.public_name),
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
          "O acesso às salas está bloqueado para este perfil.",
        );
      }
      throw error;
    }
  }

  if (user.role === "patient") {
    const { profile } = await requirePatient(client, request);
    return {
      displayName: sanitizeZoomDisplayName(profile.display_name),
      profile,
      role: "patient" as const,
    };
  }

  throw new DomainError("role_mismatch", 403, "Use uma conta participante.");
}

async function createCustomerKey(
  secret: string,
  bookingId: string,
  profileId: string,
  role: string,
) {
  return `tes_${(await hmacSha256Hex(secret, `${bookingId}:${profileId}:${role}`)).slice(0, 32)}`;
}

function zoomAccessFailure(access: ZoomAccessState, requestId: string) {
  const reason = access.reason ?? "UNKNOWN";
  return jsonResponse(
    {
      data: { access },
      error: {
        code: reason,
        message: getZoomAccessMessage(reason),
        requestId,
      },
      ok: false,
    },
    reason === "THERAPIST_NOT_ALLOWED" || reason === "THERAPIST_SUSPENDED"
      ? 403
      : 409,
  );
}

function toSafeZoomAccessError(error: unknown) {
  if (error instanceof DomainError) return error;
  if (error instanceof ZoomError) {
    return new DomainError(
      error.code,
      error.status,
      "Não foi possível abrir a sala agora.",
    );
  }

  return new DomainError(
    "internal_error",
    500,
    "Não foi possível abrir a sala agora.",
  );
}

export {};
