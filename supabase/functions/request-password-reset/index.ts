import { getRequestIp, checkRateLimit } from "../_shared/auth/rate-limit.ts";
import {
  getRateLimitSalt,
  getRuntime,
  getServiceRoleKey,
  getSiteUrl,
} from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import { createAuthActionToken } from "../_shared/auth/tokens.ts";
import { findProfileByEmail } from "../_shared/auth/users.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { isValidEmail, normalizeEmail } from "../_shared/email/validation.ts";

type RequestPasswordResetBody = {
  email?: string;
};

const runtime = getRuntime("request-password-reset");
const PUBLIC_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.";

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);
  const apiKey = runtime.env.get("EMAIL_SERVER_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    console.error(
      JSON.stringify({
        code: "PASSWORD_RESET_EMAIL_CONFIGURATION_INCOMPLETE",
        hasEmailApiKey: Boolean(apiKey),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasSupabaseUrl: Boolean(supabaseUrl),
      }),
    );
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  const body = await parseJson<RequestPasswordResetBody>(request);
  const email = normalizeEmail(body?.email);

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  const allowed = await checkRateLimit(client, {
    actionKey: "password_reset",
    identifier: email,
    ip: getRequestIp(request),
    limit: 5,
    salt: getRateLimitSalt(runtime),
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  try {
    const profile = await findProfileByEmail(client, email);

    if (!profile || profile.role === "admin") {
      return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
    }

    const { token } = await createAuthActionToken(client, {
      expiresInSeconds: 60 * 60,
      purpose: "password_reset",
      recipientEmail: email,
      recipientRole: profile.role,
      userId: profile.id,
    });
    const resetUrl = `${getSiteUrl(runtime)}/reset-senha?token=${encodeURIComponent(
      token,
    )}`;
    const provider = new HostingerMailApiProvider({ apiKey });

    const emailResult = await sendTransactionalEmail(client, provider, {
      actionKey: "password_reset",
      correlationId: crypto.randomUUID(),
      recipient: {
        email,
        name: profile.display_name,
      },
      recipientRole: profile.role,
      recipientUserId: profile.id,
      templateData: {
        name: profile.display_name,
        role: profile.role,
        url: resetUrl,
      },
    });

    if (emailResult.status !== "success") {
      console.error(
        JSON.stringify({
          code: "PASSWORD_RESET_EMAIL_DELIVERY_NOT_ACCEPTED",
          correlationId: emailResult.correlationId,
          status: emailResult.status,
        }),
      );
    }
  } catch {
    console.error(
      JSON.stringify({ code: "PASSWORD_RESET_EMAIL_DELIVERY_FAILED" }),
    );
    // Public response intentionally stays generic to avoid account enumeration.
  }

  return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
});

export {};
