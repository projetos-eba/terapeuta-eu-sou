import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Envie os dados em formato valido." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  const bookingId = isRecord(body) ? body.bookingId : null;

  if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return NextResponse.json(
      { ok: false, message: "Sessao invalida." },
      { headers: noStoreHeaders, status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_patient_access_token")?.value;

  if (!config || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "Entre na sua conta para continuar." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const response = await fetch(
    `${config.url}/functions/v1/zoom-meeting-access`,
    {
      body: JSON.stringify({ bookingId }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload ?? { ok: false }, {
    headers: noStoreHeaders,
    status: response.status,
  });
}

const noStoreHeaders = { "Cache-Control": "no-store" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
