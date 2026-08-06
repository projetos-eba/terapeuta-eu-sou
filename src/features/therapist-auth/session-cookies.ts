import type { NextResponse } from "next/server";

import type { TherapistPlan } from "@/domain/tes";

import type { TherapistPasswordSession } from "./supabase-rest";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export function setTherapistSessionCookies(
  response: NextResponse,
  session: TherapistPasswordSession,
) {
  response.cookies.set("tes_therapist_access_token", session.accessToken, {
    httpOnly: true,
    maxAge: session.expiresIn,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
  response.cookies.set("tes_therapist_refresh_token", session.refreshToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
  setTherapistPlanCookie(response, session.plan);
}

export function setTherapistPlanCookie(
  response: NextResponse,
  plan: TherapistPlan,
) {
  response.cookies.set("tes_therapist_plan", plan, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
}
