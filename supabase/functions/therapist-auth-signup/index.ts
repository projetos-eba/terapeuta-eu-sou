import {
  createAuthActionToken,
  createEmailVerificationStatusToken,
  revokeAuthActionTokens,
  revokeEmailVerificationStatusTokens,
} from "../_shared/auth/tokens.ts";
import {
  getServiceRoleKey,
  getSiteUrl,
  isEmailAutomaticallyConfirmed,
} from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  confirmAuthUserEmail,
  redirectForRole,
} from "../_shared/auth/users.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { logEmailDelivery } from "../_shared/email/logging.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { normalizeEmail } from "../_shared/email/validation.ts";

type TherapistSignupDenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

type TherapistSignupValue = {
  birthDate: string;
  email: string;
  fullName: string;
  password: string;
  phoneDigits: string;
  plan: "free" | "premium" | "premium_plus";
  termsAccepted?: boolean;
};

type SupabaseAuthUser = {
  id: string;
};

const therapistSignupDeno = (
  globalThis as typeof globalThis & { Deno?: TherapistSignupDenoRuntime }
).Deno;
const therapistSignupRuntime = assertDenoRuntime(therapistSignupDeno);
const jsonHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

therapistSignupRuntime.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = therapistSignupRuntime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(therapistSignupRuntime);
  const emailApiKey = therapistSignupRuntime.env.get("EMAIL_SERVER_API_KEY");
  let automaticallyConfirmed = false;

  try {
    automaticallyConfirmed = isEmailAutomaticallyConfirmed(
      therapistSignupRuntime,
    );
  } catch {
    return jsonResponse({ error: "invalid_email_confirmation_config" }, 500);
  }

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    (!automaticallyConfirmed && !emailApiKey)
  ) {
    return jsonResponse({ error: "missing_supabase_env" }, 503);
  }

  const value = await parseJson<TherapistSignupValue>(request);

  if (
    !value ||
    !value.email ||
    !value.password ||
    !value.fullName ||
    !isTherapistPlan(value.plan) ||
    value.termsAccepted !== true
  ) {
    return jsonResponse({ error: "invalid_payload" }, 422);
  }

  let userId: string | null = null;

  try {
    const email = normalizeEmail(value.email);
    const authUser = await supabaseJson<SupabaseAuthUser>(
      supabaseUrl,
      serviceRoleKey,
      "/auth/v1/admin/users",
      {
        body: {
          email,
          email_confirm: false,
          password: value.password,
          phone_confirm: false,
          user_metadata: {
            full_name: value.fullName,
            requested_plan: value.plan,
            role: "therapist",
          },
        },
        method: "POST",
      },
    );
    userId = authUser.id;
    const now = new Date().toISOString();

    await supabaseJson(supabaseUrl, serviceRoleKey, "/rest/v1/profiles", {
      body: {
        display_name: value.fullName,
        email,
        id: userId,
        phone: value.phoneDigits,
        role: "therapist",
      },
      method: "POST",
      prefer: "return=minimal",
    });

    await supabaseJson(
      supabaseUrl,
      serviceRoleKey,
      "/rest/v1/therapist_profiles",
      {
        body: {
          accepts_online_sessions: true,
          is_accepting_bookings: false,
          is_public: false,
          legal_name: value.fullName,
          metadata: {
            consent: {
              privacyAcceptedAt: now,
              termsAcceptedAt: now,
            },
            onboarding: {
              bankAccountRequiredForPayouts: true,
              documentsRequiredLater: true,
              initialSignupAt: now,
              publicProfileRecommended: true,
            },
            signup: {
              birthDate: value.birthDate,
              phoneDigits: value.phoneDigits,
              requestedPlan: value.plan,
              source: "therapist_auth",
            },
          },
          plan: "free",
          public_name: value.fullName,
          slug: buildUniqueSlug(value.fullName),
          status: "draft",
          user_id: userId,
        },
        method: "POST",
        prefer: "return=minimal",
      },
    );

    await registerSignupLegalAcceptances({
      actorRole: "therapist",
      context: "therapist_signup",
      profileId: userId,
      serviceRoleKey,
      source: "therapist_auth_signup",
      supabaseUrl,
    });

    const restClient = new SupabaseRestClient(supabaseUrl, serviceRoleKey);

    if (automaticallyConfirmed) {
      await revokeAuthActionTokens(restClient, userId, "email_verification");
      await revokeEmailVerificationStatusTokens(restClient, userId);
      await confirmAuthUserEmail(restClient, userId);
      await logEmailDelivery(restClient, {
        actionKey: "email_verification",
        correlationId: crypto.randomUUID(),
        errorMessage: "automatically_confirmed",
        recipientEmail: email,
        recipientRole: "therapist",
        recipientUserId: userId,
        status: "skipped",
      });

      return jsonResponse({
        mode: "automatically_confirmed",
        redirectTo: redirectForRole("therapist", "?verified=1&automatic=1"),
        userId,
      });
    }

    const { token } = await createAuthActionToken(restClient, {
      expiresInSeconds: 24 * 60 * 60,
      purpose: "email_verification",
      recipientEmail: email,
      recipientRole: "therapist",
      userId,
    });
    const { token: statusToken } = await createEmailVerificationStatusToken(
      restClient,
      {
        expiresInSeconds: 24 * 60 * 60,
        recipientRole: "therapist",
        userId,
      },
    );
    const verificationUrl = `${getSiteUrl(
      therapistSignupRuntime,
    )}/confirmar-email?token=${encodeURIComponent(token)}`;
    const provider = new HostingerMailApiProvider({ apiKey: emailApiKey! });

    const emailResult = await sendTransactionalEmail(restClient, provider, {
      actionKey: "email_verification",
      correlationId: crypto.randomUUID(),
      recipient: { email, name: value.fullName },
      recipientRole: "therapist",
      recipientUserId: userId,
      templateData: {
        name: value.fullName,
        role: "therapist",
        url: verificationUrl,
      },
    });

    if (emailResult.status !== "success") {
      throw new Error("email_verification_failed");
    }

    return jsonResponse({
      mode: "email_sent",
      statusToken,
      userId,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "THERAPIST_AUTH_SIGNUP_FAILED",
        details:
          error instanceof SupabaseHttpError ? error.safeDetails : undefined,
        message: error instanceof Error ? error.message : "UNKNOWN",
        status: error instanceof SupabaseHttpError ? error.status : undefined,
      }),
    );

    if (userId) {
      await deleteAuthUserBestEffort(supabaseUrl, serviceRoleKey, userId);
    }

    return jsonResponse(
      { error: "signup_failed" },
      error instanceof SupabaseHttpError ? error.status : 500,
    );
  }
});

async function supabaseJson<T = unknown>(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  options: {
    body?: unknown;
    method: "DELETE" | "GET" | "POST";
    prefer?: string;
  },
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    method: options.method,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new SupabaseHttpError(response.status, sanitizeErrorText(text));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function registerSignupLegalAcceptances(input: {
  actorRole: "therapist";
  context: "therapist_signup";
  profileId: string;
  serviceRoleKey: string;
  source: string;
  supabaseUrl: string;
}) {
  const requestId = crypto.randomUUID();

  for (const documentKey of ["terms-of-use", "privacy-policy"]) {
    await supabaseJson(
      input.supabaseUrl,
      input.serviceRoleKey,
      "/rest/v1/rpc/register_legal_acceptance_v1",
      {
        body: {
          p_actor_role: input.actorRole,
          p_context: input.context,
          p_document_key: documentKey,
          p_evidence: {
            source: input.source,
            userAgent: "not_stored",
          },
          p_profile_id: input.profileId,
          p_request_id: requestId,
        },
        method: "POST",
      },
    );
  }
}

async function deleteAuthUserBestEffort(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
) {
  try {
    await supabaseJson(
      supabaseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users/${userId}`,
      { method: "DELETE" },
    );
  } catch {
    // Cleanup is best-effort; callers receive only a generic failure.
  }
}

async function parseJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function buildUniqueSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "terapeuta";
  const suffix = crypto.randomUUID().slice(0, 8);

  return `${base}-${suffix}`;
}

function isTherapistPlan(
  value: unknown,
): value is TherapistSignupValue["plan"] {
  return value === "free" || value === "premium" || value === "premium_plus";
}

function assertDenoRuntime(
  runtime: TherapistSignupDenoRuntime | undefined,
): TherapistSignupDenoRuntime {
  if (!runtime) {
    throw new Error("Deno runtime is required for Supabase Edge Functions.");
  }

  return runtime;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

class SupabaseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly safeDetails?: string,
  ) {
    super("Supabase request failed.");
  }
}

function sanitizeErrorText(value: string) {
  return value.replace(/[\r\n]+/g, " ").slice(0, 500);
}

export {};
