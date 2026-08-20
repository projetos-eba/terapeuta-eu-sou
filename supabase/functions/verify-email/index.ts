import {
  claimAuthActionToken,
  consumeAuthActionToken,
  releaseAuthActionTokenClaim,
  revokeAuthActionTokens,
} from "../_shared/auth/tokens.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import { parseJson, SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  confirmAuthUserEmail,
  redirectAfterEmailConfirmation,
} from "../_shared/auth/users.ts";
import { isValidActionToken } from "../_shared/email/validation.ts";

type VerifyEmailBody = {
  token?: string;
};

const runtime = getRuntime("verify-email");

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
      { ok: false, message: "Não foi possível confirmar o e-mail." },
      503,
    );
  }

  const body = await parseJson<VerifyEmailBody>(request);
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!isValidActionToken(token)) {
    return jsonResponse({ ok: false, message: "Link inválido ou expirado." }, 400);
  }

  const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  const claimed = await claimAuthActionToken(client, {
    purpose: "email_verification",
    token,
  });

  if (!claimed) {
    return jsonResponse({ ok: false, message: "Link inválido ou expirado." }, 400);
  }

  try {
    await confirmAuthUserEmail(client, claimed.claim.user_id);
    const consumed = await consumeAuthActionToken(
      client,
      claimed.claim.id,
      claimed.claimId,
    );

    if (!consumed) {
      return jsonResponse({ ok: false, message: "Link inválido ou expirado." }, 400);
    }

    await revokeAuthActionTokens(
      client,
      claimed.claim.user_id,
      "email_verification",
    );

    return jsonResponse({
      ok: true,
      redirectTo: await redirectAfterEmailConfirmation(
        client,
        claimed.claim.recipient_role,
        claimed.claim.user_id,
        "?verified=1",
      ),
    });
  } catch {
    await releaseAuthActionTokenClaim(client, claimed.claim.id, claimed.claimId);
    return jsonResponse(
      { ok: false, message: "Não foi possível confirmar o e-mail agora." },
      500,
    );
  }
});

export {};
