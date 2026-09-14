import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Revise os dados do encontro.", 400);
  }

  const bookingId = parseBookingId(body);
  if (!bookingId) return failure("Revise os dados do encontro.", 422);

  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("tes_patient_access_token")?.value ?? null;
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const data = await invokeSupabaseFunction<{
      clientSecret: string;
      status: string;
    }>(config, "prepare-session-charge-recovery", {
      accessToken,
      body: { bookingId },
    });
    return NextResponse.json({ ok: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      if (error.status === 401 || error.status === 403) {
        return failure("Entre na sua conta para continuar.", error.status);
      }
      if (error.status === 404) {
        return failure("Encontro não encontrado.", 404);
      }
      if (error.status === 409) {
        return failure(
          "Este pagamento não precisa de uma nova confirmação.",
          409,
        );
      }
    }
    return failure(
      "Não foi possível abrir a confirmação do pagamento agora.",
      503,
    );
  }
}

function parseBookingId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bookingId = Reflect.get(value, "bookingId");
  return typeof bookingId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
    ? bookingId
    : null;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
