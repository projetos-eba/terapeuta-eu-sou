import { checkRateLimit, getRequestIp } from "../_shared/auth/rate-limit.ts";
import {
  getRateLimitSalt,
  getRuntime,
  getServiceRoleKey,
  getSiteUrl,
  isEmailAutomaticallyConfirmed,
} from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  createAuthActionToken,
  findEmailVerificationStatusToken,
} from "../_shared/auth/tokens.ts";
import {
  findProfileByEmail,
  getAuthUser,
  getProfileById,
} from "../_shared/auth/users.ts";
import { logEmailDelivery } from "../_shared/email/logging.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { isValidEmail, normalizeEmail } from "../_shared/email/validation.ts";

type ResendBody = {
  email?: string;
  statusToken?: string;
};

const runtime = getRuntime("resend-email-verification");
const PUBLIC_MESSAGE =
  "Se houver uma conta pendente para este e-mail, enviaremos uma nova confirmação.";

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);
  const apiKey = runtime.env.get("EMAIL_SERVER_API_KEY");
  let automaticallyConfirmed = false;

  try {
    automaticallyConfirmed = isEmailAutomaticallyConfirmed(runtime);
  } catch {
    console.error(
      JSON.stringify({
        code: "EMAIL_VERIFICATION_RESEND_CONFIRMATION_CONFIG_INVALID",
      }),
    );
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  if (!supabaseUrl || !serviceRoleKey || !apiKey || automaticallyConfirmed) {
    console.error(
      JSON.stringify({
        code: "EMAIL_VERIFICATION_RESEND_CONFIGURATION_INCOMPLETE",
        automaticallyConfirmed,
        hasEmailApiKey: Boolean(apiKey),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasSupabaseUrl: Boolean(supabaseUrl),
      }),
    );
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  const body = await parseJson<ResendBody>(request);
  const email = normalizeEmail(body?.email);
  const statusToken =
    typeof body?.statusToken === "string" ? body.statusToken.trim() : "";

  if (!isValidEmail(email) && !statusToken) {
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  const allowed = await checkRateLimit(client, {
    actionKey: "email_verification",
    identifier: statusToken || email,
    ip: getRequestIp(request),
    limit: 1,
    salt: getRateLimitSalt(runtime),
    windowSeconds: 60,
  });

  if (!allowed) {
    return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
  }

  try {
    const profile = statusToken
      ? await findProfileByStatusToken(client, statusToken)
      : await findProfileByEmail(client, email);

    if (!profile || profile.role === "admin") {
      return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
    }

    const recipientEmail = normalizeEmail(profile.email ?? email);
    if (!isValidEmail(recipientEmail)) {
      return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
    }

    const authUser = await getAuthUser(client, profile.id);
    if (profile.email_confirmed_at || authUser.email_confirmed_at) {
      await logEmailDelivery(client, {
        actionKey: "email_verification",
        correlationId: crypto.randomUUID(),
        errorMessage: "already_confirmed",
        recipientEmail,
        recipientRole: profile.role,
        recipientUserId: profile.id,
        status: "skipped",
      });
      return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
    }

    const { token } = await createAuthActionToken(client, {
      expiresInSeconds: 24 * 60 * 60,
      purpose: "email_verification",
      recipientEmail,
      recipientRole: profile.role,
      userId: profile.id,
    });
    const verificationUrl = `${getSiteUrl(
      runtime,
    )}/confirmar-email?token=${encodeURIComponent(token)}`;
    const provider = new HostingerMailApiProvider({ apiKey });

    const emailResult = await sendTransactionalEmail(client, provider, {
      actionKey: "email_verification",
      correlationId: crypto.randomUUID(),
      recipient: {
        email: recipientEmail,
        name: profile.display_name,
      },
      recipientRole: profile.role,
      recipientUserId: profile.id,
      templateData: {
        name: profile.display_name,
        role: profile.role,
        url: verificationUrl,
      },
    });

    if (emailResult.status !== "success") {
      console.error(
        JSON.stringify({
          code: "EMAIL_VERIFICATION_RESEND_NOT_ACCEPTED",
          correlationId: emailResult.correlationId,
          status: emailResult.status,
        }),
      );
    }
  } catch {
    console.error(JSON.stringify({ code: "EMAIL_VERIFICATION_RESEND_FAILED" }));
    // Public response intentionally stays generic.
  }

  return jsonResponse({ ok: true, message: PUBLIC_MESSAGE });
});

async function findProfileByStatusToken(
  client: SupabaseRestClient,
  statusToken: string,
) {
  const token = await findEmailVerificationStatusToken(client, statusToken);
  if (!token || token.confirmed_at) {
    return null;
  }

  const profile = await getProfileById(client, token.user_id);
  if (!profile || profile.role !== token.recipient_role) {
    return null;
  }

  return profile;
}

export {};
