import {
  AuthLoginEmailUnconfirmedError,
  AuthLoginRoleError,
  AuthLoginSupabaseError,
  loginWithPasswordOrMaster,
} from "../_shared/auth/login.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { parseJson, SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";

type LoginBody = {
  email?: string;
  password?: string;
};

const runtime = getRuntime("admin-auth-login");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);
  const publicApiKey = getPublicApiKey(request);

  if (!supabaseUrl || !serviceRoleKey || !publicApiKey) {
    return jsonResponse({ ok: false, error: "missing_supabase_env" }, 503);
  }

  const body = await parseJson<LoginBody>(request);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 422);
  }

  try {
    const session = await loginWithPasswordOrMaster({
      client: new SupabaseRestClient(supabaseUrl, serviceRoleKey),
      email,
      expectedRole: "admin",
      masterPassword: runtime.env.get("MASTER_PASSWORD"),
      password,
      publicApiKey,
      supabaseUrl,
    });

    return jsonResponse({ ok: true, ...session });
  } catch (error) {
    return loginErrorResponse(error);
  }
});

function getPublicApiKey(request: Request) {
  return (
    request.headers.get("apikey") ??
      runtime.env.get("SUPABASE_ANON_KEY") ??
      runtime.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      ""
  );
}

function loginErrorResponse(error: unknown) {
  if (error instanceof AuthLoginEmailUnconfirmedError) {
    return jsonResponse({ ok: false, error: "email_unconfirmed" }, 409);
  }

  if (error instanceof AuthLoginRoleError) {
    return jsonResponse({ ok: false, error: "role_mismatch" }, 403);
  }

  if (error instanceof AuthLoginSupabaseError) {
    return jsonResponse({ ok: false, error: "invalid_credentials" }, 401);
  }

  return jsonResponse({ ok: false, error: "login_failed" }, 500);
}

export {};
