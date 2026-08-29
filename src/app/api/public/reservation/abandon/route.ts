import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
} from "@/lib/supabase/edge-functions";

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const token = (await cookies()).get("tes_patient_access_token")?.value;
  if (!config || !token)
    return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await invokeSupabaseFunction(config, "reservation-abandon", {
      accessToken: token,
      body,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
