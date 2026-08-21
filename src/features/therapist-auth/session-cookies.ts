import type { NextResponse } from "next/server";

import type { TherapistPlan } from "@/domain/tes";
import { setAuthSessionCookies } from "@/lib/auth/session-cookies";

import type { TherapistPasswordSession } from "./supabase-rest";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export function setTherapistSessionCookies(
  response: NextResponse,
  session: TherapistPasswordSession,
) {
  setAuthSessionCookies(response, "therapist", session);
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
