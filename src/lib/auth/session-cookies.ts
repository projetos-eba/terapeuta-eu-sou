import type { NextResponse } from "next/server";

export type AuthenticatedRole = "admin" | "patient" | "therapist";

export type AuthSessionCookies = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
};

export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export function getAccessTokenCookieName(role: AuthenticatedRole) {
  return `tes_${role}_access_token`;
}

export function getRefreshTokenCookieName(role: AuthenticatedRole) {
  return `tes_${role}_refresh_token`;
}

export function setAuthSessionCookies(
  response: NextResponse,
  role: AuthenticatedRole,
  session: AuthSessionCookies,
) {
  response.cookies.set(getAccessTokenCookieName(role), session.accessToken, {
    httpOnly: true,
    maxAge: session.expiresIn,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
  response.cookies.set(getRefreshTokenCookieName(role), session.refreshToken, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
}

export function clearAuthSessionCookies(
  response: NextResponse,
  role: AuthenticatedRole,
) {
  for (const name of [
    getAccessTokenCookieName(role),
    getRefreshTokenCookieName(role),
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: SECURE_COOKIE,
    });
  }
}
