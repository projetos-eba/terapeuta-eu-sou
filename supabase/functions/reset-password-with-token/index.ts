import {
  consumeAuthActionToken,
  claimAuthActionToken,
  releaseAuthActionTokenClaim,
} from "../_shared/auth/tokens.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  confirmAuthUserEmail,
  redirectForRole,
  updateAuthUserPassword,
} from "../_shared/auth/users.ts";
import { requestEmailOutboxDispatch } from "../_shared/email/outbox-dispatch.ts";
import { isValidActionToken } from "../_shared/email/validation.ts";

type ResetPasswordBody = {
  confirmPassword?: string;
  password?: string;
  token?: string;
};

const runtime = getRuntime("reset-password-with-token");

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
      { ok: false, message: "Não foi possível redefinir a senha." },
      503,
    );
  }

  const body = await parseJson<ResetPasswordBody>(request);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (
    !isValidActionToken(token) ||
    password.length < 8 ||
    password !== confirmPassword
  ) {
    return jsonResponse(
      { ok: false, message: "Confira o link e a nova senha informada." },
      422,
    );
  }

  const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  const claimed = await claimAuthActionToken(client, {
    purpose: "password_reset",
    token,
  });

  if (!claimed) {
    return jsonResponse(
      { ok: false, message: "Link inválido ou expirado." },
      400,
    );
  }

  try {
    await confirmAuthUserEmail(client, claimed.claim.user_id);
    await updateAuthUserPassword(client, claimed.claim.user_id, password);
    const consumed = await consumeAuthActionToken(
      client,
      claimed.claim.id,
      claimed.claimId,
    );

    if (!consumed) {
      return jsonResponse(
        { ok: false, message: "Link inválido ou expirado." },
        400,
      );
    }

    // Password persistence is authoritative. Notification is enqueued only
    // after the one-time token is consumed, and can never roll back a valid
    // credential update if configuration or the dispatcher is unavailable.
    await client
      .rpc("enqueue_transactional_email_v1", {
        p_action_key: "password_changed",
        p_domain_event_id: claimed.claim.id,
        p_payload: {},
        p_recipient_key: `profile:${claimed.claim.user_id}`,
        p_recipient_user_id: claimed.claim.user_id,
        p_related_entity_id: claimed.claim.id,
        p_related_entity_type: "auth_action_token",
      })
      .catch(() => undefined);
    void requestEmailOutboxDispatch(runtime);

    return jsonResponse({
      ok: true,
      redirectTo: redirectForRole(claimed.claim.recipient_role, "?reset=1"),
    });
  } catch {
    await releaseAuthActionTokenClaim(
      client,
      claimed.claim.id,
      claimed.claimId,
    );
    return jsonResponse(
      { ok: false, message: "Não foi possível redefinir a senha agora." },
      500,
    );
  }
});

export {};
