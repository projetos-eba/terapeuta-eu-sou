import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  const intent = isRecord(body) ? body.intent : null;

  if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return NextResponse.json(
      { ok: false, message: "Sessao invalida." },
      { headers: noStoreHeaders, status: 422 },
    );
  }
  if (intent !== null && intent !== "join" && intent !== "preview") {
    return NextResponse.json(
      { ok: false, message: "Acao de acesso invalida." },
      { headers: noStoreHeaders, status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  const accessToken = await getAvailableAccessToken();

  if (!config || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "Entre na sua conta para continuar." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const response = await fetch(
    `${config.url}/functions/v1/zoom-video-session-access`,
    {
      body: JSON.stringify({ bookingId, intent: intent ?? "join" }),
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

async function getAvailableAccessToken() {
  const cookieStore = await cookies();

  return (
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_patient_access_token")?.value ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
