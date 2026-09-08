import { handleOptions } from "../_shared/auth/cors.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  mapSessionJourneyThemeDatabaseError,
  type SessionJourneyThemeCommandBody,
  validateSessionJourneyThemeCommand,
} from "./theme-command.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SelectionRow = {
  booking_id: string;
  created_at: string;
  taxonomy_version: string;
  theme_keys: string[];
};

const runtime = getRuntime("session-journey-themes-command");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError("UNAVAILABLE", 503, "Configuração indisponível.");
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { profile: therapist, user } = await requirePremiumPlusTherapist(
      client,
      request,
    );

    if (request.method === "GET") {
      const bookingId = new URL(request.url).searchParams.get("bookingId");
      if (!isUuid(bookingId)) {
        throw new DomainError("VALIDATION_ERROR", 422, "Sessão inválida.");
      }

      const selection = await getSelection(client, therapist.id, bookingId);
      return success({ selection });
    }

    if (request.method !== "POST") {
      throw new DomainError("METHOD_NOT_ALLOWED", 405, "Método não permitido.");
    }

    const command = validateSessionJourneyThemeCommand(
      await parseJsonBody<SessionJourneyThemeCommandBody>(request),
    );

    try {
      const result = await client.rpc("save_therapist_session_journey_themes_v1", {
        p_acknowledged: command.acknowledged,
        p_actor_user_id: user.id,
        p_booking_id: command.bookingId,
        p_request_id: command.requestId,
        p_theme_keys: command.themeKeys,
      });

      return success(result);
    } catch (error) {
      logDatabaseFailure(error, correlationId, user.id);
      throw mapSessionJourneyThemeDatabaseError(error);
    }
  } catch (error) {
    logFailure(error, correlationId);
    return failure(error, correlationId);
  }
});

async function requirePremiumPlusTherapist(
  client: SupabaseRestClient,
  request: Request,
) {
  const result = await requireTherapist(client, request);
  if (result.profile.plan !== "premium_plus") {
    throw new DomainError(
      "FORBIDDEN",
      403,
      "Esta opção está disponível no Premium Plus.",
    );
  }
  return result;
}

async function getSelection(
  client: SupabaseRestClient,
  therapistProfileId: string,
  bookingId: string,
) {
  const rows = await client.get<SelectionRow[]>(
    `/rest/v1/booking_journey_theme_selections?select=booking_id,theme_keys,taxonomy_version,created_at&booking_id=eq.${encodeURIComponent(bookingId)}&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&limit=1`,
  );
  const selection = rows[0];
  return selection
    ? {
        bookingId: selection.booking_id,
        selectedAt: selection.created_at,
        taxonomyVersion: selection.taxonomy_version,
        themeKeys: selection.theme_keys,
      }
    : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function logFailure(error: unknown, correlationId: string) {
  console.error(
    JSON.stringify({
      code: error instanceof DomainError ? error.code : "session_journey_themes_failed",
      correlation_id: correlationId,
      operation: "session_journey_themes_command",
    }),
  );
}

function logDatabaseFailure(error: unknown, correlationId: string, userId: string) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(
    JSON.stringify({
      correlation_id: correlationId,
      details: error.safeDetails,
      operation: "session_journey_themes_command.database",
      status: error.status,
      user_id: userId,
    }),
  );
}
