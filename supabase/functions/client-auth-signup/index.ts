type ClientSignupDenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

type ClientSignupValue = {
  birthDate: string;
  email: string;
  name: string;
  password: string;
  phoneDigits: string;
};

type SupabaseAuthUser = {
  id: string;
};

const clientSignupDeno = (
  globalThis as typeof globalThis & { Deno?: ClientSignupDenoRuntime }
).Deno;
const clientSignupRuntime = assertDenoRuntime(clientSignupDeno);
const jsonHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

clientSignupRuntime.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = clientSignupRuntime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_supabase_env" }, 500);
  }

  const value = await parseJson<ClientSignupValue>(request);

  if (!value || !value.email || !value.password || !value.name) {
    return jsonResponse({ error: "invalid_payload" }, 422);
  }

  let userId: string | null = null;

  try {
    const authUser = await supabaseJson<SupabaseAuthUser>(
      supabaseUrl,
      serviceRoleKey,
      "/auth/v1/admin/users",
      {
        body: {
          email: value.email,
          email_confirm: true,
          password: value.password,
          phone_confirm: false,
          user_metadata: {
            full_name: value.name,
            role: "patient",
          },
        },
        method: "POST",
      },
    );
    userId = authUser.id;
    const now = new Date().toISOString();

    await supabaseJson(supabaseUrl, serviceRoleKey, "/rest/v1/profiles", {
      body: {
        display_name: value.name,
        email: value.email,
        id: userId,
        phone: value.phoneDigits,
        role: "patient",
      },
      method: "POST",
      prefer: "return=minimal",
    });

    await supabaseJson(supabaseUrl, serviceRoleKey, "/rest/v1/patient_profiles", {
      body: {
        birth_date: value.birthDate,
        display_name: value.name,
        marketing_consent: false,
        metadata: {
          consent: {
            privacyAcceptedAt: now,
            termsAcceptedAt: now,
          },
          onboarding: {
            initialSignupAt: now,
            journeyRecommended: true,
            profileCanBeCompletedLater: true,
          },
          signup: {
            phoneDigits: value.phoneDigits,
            source: "client_auth",
          },
        },
        phone: value.phoneDigits,
        timezone: "America/Sao_Paulo",
        user_id: userId,
      },
      method: "POST",
      prefer: "return=minimal",
    });

    return jsonResponse({ userId });
  } catch (error) {
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

  if (!response.ok) {
    throw new SupabaseHttpError(response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
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

function getServiceRoleKey() {
  return (
    getDefaultKey(clientSignupRuntime.env.get("SUPABASE_SECRET_KEYS")) ??
    clientSignupRuntime.env.get("SUPABASE_SECRET_KEY") ??
    clientSignupRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}

function getDefaultKey(rawKeys: string | undefined) {
  if (!rawKeys) return null;

  try {
    const keys = JSON.parse(rawKeys) as Record<string, unknown>;
    const defaultKey = keys.default;

    return typeof defaultKey === "string" && defaultKey ? defaultKey : null;
  } catch {
    return null;
  }
}

function assertDenoRuntime(
  runtime: ClientSignupDenoRuntime | undefined,
): ClientSignupDenoRuntime {
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
  constructor(readonly status: number) {
    super("Supabase request failed.");
  }
}

export {};
