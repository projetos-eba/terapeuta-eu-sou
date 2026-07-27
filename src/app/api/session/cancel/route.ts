import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  const parsed = parseActionBody(body);
  if (!parsed) {
    return failure("Revise os dados do cancelamento.", 422);
  }

  const config = getSupabasePublicConfig();
  const accessToken = await getActorAccessToken(parsed.actorRole);

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/request-session-cancellation`,
      {
        body: JSON.stringify({
          bookingId: parsed.bookingId,
          reason: parsed.reason,
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
    return failure("Não foi possível cancelar esta sessão agora.", 503);
  }
}

async function getActorAccessToken(actorRole: "patient" | "therapist") {
  const cookieStore = await cookies();
  return (
    cookieStore.get(
      actorRole === "patient"
        ? "tes_patient_access_token"
        : "tes_therapist_access_token",
    )?.value ?? null
  );
}

function parseActionBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bookingId = Reflect.get(value, "bookingId");
  const actorRole = Reflect.get(value, "actorRole");
  const reason = Reflect.get(value, "reason");

  if (
    typeof bookingId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(bookingId) ||
    (actorRole !== "patient" && actorRole !== "therapist") ||
    (reason !== undefined && typeof reason !== "string")
  ) {
    return null;
  }

  return {
    actorRole,
    bookingId,
    reason: reason || undefined,
  };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
