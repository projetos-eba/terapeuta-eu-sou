import type { NextResponse } from "next/server";

import { setAuthSessionCookies } from "@/lib/auth/session-cookies";

import type { AdminPasswordSession } from "./supabase-rest";

export function setAdminSessionCookies(
  response: NextResponse,
  session: AdminPasswordSession,
) {
  setAuthSessionCookies(response, "admin", session, {
    userId: session.userId,
  });
}
