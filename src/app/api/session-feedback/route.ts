import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const bookingId = new URL(request.url).searchParams.get("bookingId");
  if (!isUuid(bookingId)) return failure("Sessão inválida.", 422);

  const accessToken = await getAccessToken();
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return failure("Entre na sua conta para continuar.", 401);

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/get_session_feedback_v2`, {
      body: JSON.stringify({ p_booking_id: bookingId }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return failure("Não foi possível consultar o feedback agora.", response.status === 403 ? 403 : 503);
    }

    return NextResponse.json({ data: payload, ok: true }, { headers: noStoreHeaders });
  } catch {
    return failure("Não foi possível consultar o feedback agora.", 503);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  if (!isRecord(body) || !isUuid(body.bookingId)) {
    return failure("Revise os dados do feedback.", 422);
  }

  const accessToken = await getAccessToken();
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return failure("Entre na sua conta para continuar.", 401);

  try {
    const response = await fetch(`${config.url}/functions/v1/session-feedback-command`, {
      body: JSON.stringify({
        bookingId: body.bookingId,
        comment: body.comment,
        notPerformedReason: body.notPerformedReason,
        outcome: body.outcome,
        rating: body.rating,
        requestId: body.requestId,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json().catch(() => null);

    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Não foi possível registrar o feedback agora.", 503);
  }
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_patient_access_token")?.value ??
    null
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
