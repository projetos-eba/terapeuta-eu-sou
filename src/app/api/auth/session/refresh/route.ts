import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  clearAuthSessionCookies,
  getAccessTokenCookieName,
  getRefreshTokenCookieName,
  getSessionMarkerCookieName,
  setAuthSessionCookies,
  type AuthenticatedRole,
} from "@/lib/auth/session-cookies";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const REFRESH_WINDOW_MS = 15 * 60 * 1000;
const noStoreHeaders = { "Cache-Control": "no-store" };

type SupabaseRefreshSession = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
};

type SupabaseUser = {
  id?: unknown;
};

type Profile = {
  role?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return failure("Origem da requisicao invalida.", 403);
  }

  const role = await readRole(request);

  if (!role) {
    return failure("Acao de acesso invalida.", 422);
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(getAccessTokenCookieName(role))?.value;
  const refreshToken = cookieStore.get(getRefreshTokenCookieName(role))?.value;
  const sessionMarker = cookieStore.get(getSessionMarkerCookieName(role))?.value;

  if (!refreshToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  if (accessToken && !isWithinRefreshWindow(accessToken)) {
    return NextResponse.json(
      { ok: true, refreshed: false },
      { headers: noStoreHeaders },
    );
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return failure("Nao foi possivel manter seu acesso agora.", 503);
  }

  try {
    const session = await refreshSupabaseSession({
      apiKey: config.apiKey,
      refreshToken,
      url: config.url,
    });
    const roleValidation = await validateSessionRole({
      accessToken: session.accessToken,
      apiKey: config.apiKey,
      role,
      url: config.url,
    });

    if (roleValidation === "invalid") {
      return invalidSession(role);
    }

    const response = NextResponse.json(
      roleValidation === "valid"
        ? { ok: true, refreshed: true }
        : {
            ok: false,
            message: "Nao foi possivel confirmar seu acesso agora.",
          },
      {
        headers: noStoreHeaders,
        status: roleValidation === "valid" ? 200 : 503,
      },
    );
    setAuthSessionCookies(response, role, session, { sessionMarker });
    return response;
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) {
      return invalidSession(role);
    }

    return failure("Nao foi possivel manter seu acesso agora.", 503);
  }
}

class InvalidRefreshTokenError extends Error {}

async function readRole(request: Request): Promise<AuthenticatedRole | null> {
  try {
    const body = (await request.json()) as { role?: unknown };
    return isAuthenticatedRole(body.role) ? body.role : null;
  } catch {
    return null;
  }
}

async function refreshSupabaseSession(input: {
  apiKey: string;
  refreshToken: string;
  url: string;
}) {
  let response: Response;

  try {
    response = await fetch(
      `${input.url}/auth/v1/token?grant_type=refresh_token`,
      {
        body: JSON.stringify({ refresh_token: input.refreshToken }),
        cache: "no-store",
        headers: {
          apikey: input.apiKey,
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
  } catch {
    throw new Error("refresh_session_unavailable");
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new InvalidRefreshTokenError();
    }

    throw new Error("refresh_session_unavailable");
  }

  const payload = (await response.json()) as SupabaseRefreshSession;
  const expiresIn = normalizeExpiresIn(payload.expires_in);

  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    !expiresIn
  ) {
    throw new Error("refresh_session_invalid_payload");
  }

  return {
    accessToken: payload.access_token,
    expiresIn,
    refreshToken: payload.refresh_token,
  };
}

async function validateSessionRole(input: {
  accessToken: string;
  apiKey: string;
  role: AuthenticatedRole;
  url: string;
}): Promise<"invalid" | "unavailable" | "valid"> {
  try {
    const userResponse = await fetch(`${input.url}/auth/v1/user`, {
      cache: "no-store",
      headers: authHeaders(input),
    });

    if (!userResponse.ok) {
      return userResponse.status >= 500 ? "unavailable" : "invalid";
    }

    const user = (await userResponse.json()) as SupabaseUser;

    if (typeof user.id !== "string") return "invalid";

    const profileResponse = await fetch(
      `${input.url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      {
        cache: "no-store",
        headers: authHeaders(input),
      },
    );

    if (!profileResponse.ok) {
      return profileResponse.status >= 500 ? "unavailable" : "invalid";
    }

    const profiles = (await profileResponse.json()) as Profile[];
    return profiles[0]?.role === input.role ? "valid" : "invalid";
  } catch {
    return "unavailable";
  }
}

function authHeaders(input: { accessToken: string; apiKey: string }) {
  return {
    apikey: input.apiKey,
    Authorization: `Bearer ${input.accessToken}`,
  };
}

function isWithinRefreshWindow(accessToken: string) {
  const expiresAt = readJwtExpiry(accessToken);

  // The JWT payload is read only to avoid unnecessary rotation. Authorization
  // continues to be verified by Supabase after a refresh.
  return expiresAt === null || expiresAt - Date.now() <= REFRESH_WINDOW_MS;
}

function readJwtExpiry(accessToken: string) {
  try {
    const payload = accessToken.split(".")[1];

    if (!payload) return null;

    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const value = JSON.parse(decoded) as { exp?: unknown };

    return typeof value.exp === "number" && Number.isFinite(value.exp)
      ? value.exp * 1000
      : null;
  } catch {
    return null;
  }
}

function normalizeExpiresIn(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function invalidSession(role: AuthenticatedRole) {
  const response = failure("Entre na sua conta para continuar.", 401);
  clearAuthSessionCookies(response, role);
  return response;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { headers: noStoreHeaders, status },
  );
}

function isAuthenticatedRole(value: unknown): value is AuthenticatedRole {
  return value === "admin" || value === "patient" || value === "therapist";
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
