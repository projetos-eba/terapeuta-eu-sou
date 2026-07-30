import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getClientSessionSummary,
  logoutClientSession,
} from "@/features/client-auth/session-summary";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  const patient = await getClientSessionSummary(accessToken);

  if (!patient) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    patient,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  await logoutClientSession(accessToken);

  const response = NextResponse.json({ ok: true });
  clearCookie(response, "tes_patient_access_token");
  clearCookie(response, "tes_patient_refresh_token");

  return response;
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: SECURE_COOKIE,
  });
}
