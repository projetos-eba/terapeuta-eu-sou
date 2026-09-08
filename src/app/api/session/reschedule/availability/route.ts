import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const actorRole = url.searchParams.get("actorRole");
  const bookingId = url.searchParams.get("bookingId");
  const scope = url.searchParams.get("scope") ?? "next";
  const anchor = url.searchParams.get("anchor");

  if (
    (actorRole !== "patient" && actorRole !== "therapist") ||
    !bookingId ||
    !UUID.test(bookingId) ||
    !["day", "month", "next"].includes(scope) ||
    ((scope === "day" || scope === "month") &&
      (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)))
  ) {
    return failure("Revise os dados da agenda.", 422);
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
      `${config.url}/functions/v1/session-reschedule`,
      {
        body: JSON.stringify({
          action: "availability",
          anchor: anchor ?? undefined,
          bookingId,
          scope,
        }),
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
  } catch {
    return failure("Não foi possível carregar a agenda agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
