import { checkRateLimit, getRequestIp } from "../_shared/auth/rate-limit.ts";
import {
  getRateLimitSalt,
  getRuntime,
  getServiceRoleKey,
} from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import { parseJson, SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  findEmailVerificationStatusToken,
  markEmailVerificationStatusConfirmed,
} from "../_shared/auth/tokens.ts";
import {
  getAuthUser,
  getProfileById,
  redirectAfterEmailConfirmation,
} from "../_shared/auth/users.ts";
import { isValidActionToken } from "../_shared/email/validation.ts";

type StatusBody = {
  statusToken?: string;
};

const runtime = getRuntime("check-email-verification-status");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, message: "Não foi possível verificar a confirmação." },
      503,
    );
  }

  const body = await parseJson<StatusBody>(request);
  const statusToken = typeof body?.statusToken === "string"
    ? body.statusToken.trim()
    : "";

  if (!isValidActionToken(statusToken)) {
    return jsonResponse(
      { ok: false, message: "Não foi possível verificar a confirmação." },
      400,
    );
  }

  try {
    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const allowed = await checkRateLimit(client, {
      actionKey: "email_verification_status",
      identifier: statusToken,
      ip: getRequestIp(request),
      limit: 18,
      salt: getRateLimitSalt(runtime),
      windowSeconds: 60,
    });

    if (!allowed) {
      return jsonResponse({
        confirmed: false,
        destination: null,
        ok: true,
      });
    }

    const status = await findEmailVerificationStatusToken(client, statusToken);

    if (!status) {
      return jsonResponse(
        { ok: false, message: "Não foi possível verificar a confirmação." },
        400,
      );
    }

    const profile = await getProfileById(client, status.user_id);

    if (
      !profile ||
      profile.role !== status.recipient_role ||
      profile.role === "admin"
    ) {
      return jsonResponse(
        { ok: false, message: "Não foi possível verificar a confirmação." },
        400,
      );
    }

    const authUser = await getAuthUser(client, status.user_id);
    const confirmed = Boolean(
      profile.email_confirmed_at || authUser.email_confirmed_at,
    );

    if (!confirmed) {
      return jsonResponse({
        confirmed: false,
        destination: null,
        ok: true,
      });
    }

    await markEmailVerificationStatusConfirmed(client, status.id);

    return jsonResponse({
      confirmed: true,
      destination: await redirectAfterEmailConfirmation(
        client,
        status.recipient_role,
        status.user_id,
        "?verified=1",
      ),
      ok: true,
    });
  } catch {
    return jsonResponse(
      { ok: false, message: "Não foi possível verificar a confirmação." },
      500,
    );
  }
});

export {};
