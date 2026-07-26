import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  getAuthorizedZoomBooking,
  sanitizeZoomDisplayName,
} from "../_shared/zoom/booking-authorization.ts";
import { getZoomConfig } from "../_shared/zoom/config.ts";
import { hmacSha256Hex } from "../_shared/zoom/crypto.ts";
import {
  createMeetingSdkJwt,
  normalizeMeetingSdkRole,
} from "../_shared/zoom/meeting-sdk-jwt.ts";
import { getZoomMeeting } from "../_shared/zoom/meetings.ts";
import { requireUuid } from "../_shared/zoom/schemas.ts";
import { getZoomZak } from "../_shared/zoom/zak.ts";

type Body = {
  bookingId?: string;
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

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const body = await parseJsonBody<Body>(request);
    const bookingId = requireUuid(body.bookingId);
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
    const booking = await getAuthorizedZoomBooking({
      bookingId,
      client,
      profileId: actor.profile.id,
      role: actor.role,
    });
    assertJoinWindow(booking.starts_at, booking.ends_at);

    const [localMeeting] = await client.get<ZoomMeetingRow[]>(
      `/rest/v1/zoom_meetings?select=id,booking_id,zoom_meeting_id,zoom_host_user_id,scheduled_starts_at,scheduled_ends_at,duration_minutes,status&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
    );

    if (!localMeeting || !localMeeting.zoom_meeting_id) {
      throw new DomainError(
        "zoom_room_preparing",
        409,
        "A sala ainda esta em preparacao. Tente novamente em instantes.",
      );
    }

    if (["canceled", "ended", "failed"].includes(localMeeting.status)) {
      throw new DomainError(
        "zoom_room_unavailable",
        409,
        "Esta sala nao esta disponivel.",
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

    return success({
      customerKey,
      meetingNumber: String(providerMeeting.id),
      passWord: providerMeeting.password ?? "",
      role,
      sdkKey: config.meetingSdkClientId,
      signature,
      userName: actor.displayName,
      zak: zak ?? undefined,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function resolveActor(client: SupabaseRestClient, request: Request) {
  try {
    const { profile } = await requireTherapist(client, request, {
      allowBlockedStatus: true,
    });

    return {
      displayName: sanitizeZoomDisplayName(profile.public_name),
      profile,
      role: "therapist" as const,
    };
  } catch {
    const { profile } = await requirePatient(client, request);

    return {
      displayName: sanitizeZoomDisplayName(profile.display_name),
      profile,
      role: "patient" as const,
    };
  }
}

function assertJoinWindow(startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (now < start - 15 * 60_000) {
    throw new DomainError(
      "zoom_room_not_open",
      409,
      "A sala fica disponivel alguns minutos antes do horario.",
    );
  }

  if (now > end + 30 * 60_000) {
    throw new DomainError(
      "zoom_room_closed",
      409,
      "Esta sessao ja foi encerrada.",
    );
  }
}

async function createCustomerKey(
  secret: string,
  bookingId: string,
  profileId: string,
  role: string,
) {
  return `tes_${(await hmacSha256Hex(secret, `${bookingId}:${profileId}:${role}`)).slice(0, 32)}`;
}

export {};
