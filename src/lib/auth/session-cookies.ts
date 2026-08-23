import type { NextResponse } from "next/server";

import { createHash, randomUUID } from "node:crypto";

import {
  getSessionMarkerCookieName,
  type AuthenticatedRole,
} from "./session-marker";

export type { AuthenticatedRole } from "./session-marker";
export { getSessionMarkerCookieName } from "./session-marker";

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
  options: { sessionMarker?: string; userId?: string } = {},
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
  response.cookies.set(
    getSessionMarkerCookieName(role),
    options.sessionMarker ??
      (options.userId
        ? createSessionIdentityMarker(role, options.userId)
        : randomUUID()),
    {
      httpOnly: false,
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: SECURE_COOKIE,
    },
  );
}

export function createSessionIdentityMarker(
  role: AuthenticatedRole,
  userId: string,
) {
  return createHash("sha256")
    .update(`tes-auth-session:${role}:${userId}`)
    .digest("hex");
}

export function clearAuthSessionCookies(
  response: NextResponse,
  role: AuthenticatedRole,
) {
  for (const name of [
    getAccessTokenCookieName(role),
    getRefreshTokenCookieName(role),
    getSessionMarkerCookieName(role),
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
