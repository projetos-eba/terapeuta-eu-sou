import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return failure("Revise os dados do aviso.", 422);
  }

  const actorRole = Reflect.get(body, "actorRole");
  const bookingId = Reflect.get(body, "bookingId");
  const bookingVersion = Reflect.get(body, "bookingVersion");
  if (
    (actorRole !== "patient" && actorRole !== "therapist") ||
    typeof bookingId !== "string" ||
    !uuidPattern.test(bookingId) ||
    !Number.isSafeInteger(bookingVersion) ||
    bookingVersion < 1
  ) {
    return failure("Revise os dados do aviso.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(
    actorRole === "patient"
      ? "tes_patient_access_token"
      : "tes_therapist_access_token",
  )?.value;
  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/send_session_delay_notice_v1`,
      {
        body: JSON.stringify({
          p_booking_id: bookingId,
          p_expected_booking_version: bookingVersion,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok) {
      return failure(
        response.status === 403
          ? "Este aviso não está disponível para sua conta."
          : "O prazo para enviar este aviso terminou ou o encontro mudou. Atualize os detalhes.",
        response.status === 403 ? 403 : 409,
      );
    }

    const result = await response.json();
    return NextResponse.json(
      { ok: true, notice: result },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível enviar o aviso agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
