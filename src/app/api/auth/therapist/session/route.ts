import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getTherapistSessionSummary,
  logoutTherapistSession,
} from "@/features/therapist-auth/session-summary";
import { clearAuthSessionCookies } from "@/lib/auth/session-cookies";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  const therapist = await getTherapistSessionSummary(accessToken);

  if (!therapist) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    therapist,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  await logoutTherapistSession(accessToken);

  const response = NextResponse.json({ ok: true });
  clearAuthSessionCookies(response, "therapist");
  response.cookies.set("tes_therapist_plan", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });

  return response;
}
