import type { NextResponse } from "next/server";

import type { AdminPasswordSession } from "./supabase-rest";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export function setAdminSessionCookies(
  response: NextResponse,
  session: AdminPasswordSession,
) {
  response.cookies.set("tes_admin_access_token", session.accessToken, {
    httpOnly: true,
    maxAge: session.expiresIn,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
  response.cookies.set("tes_admin_refresh_token", session.refreshToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
}
