import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const bookingId = new URL(request.url).searchParams.get("bookingId");
  if (!isUuid(bookingId)) return failure("Sessão inválida.", 422);

  return forwardToCommand(`?bookingId=${encodeURIComponent(bookingId)}`, "GET");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  if (!isRecord(body) || !isUuid(body.bookingId)) {
    return failure("Revise os temas selecionados.", 422);
  }

  return forwardToCommand("", "POST", body);
}

async function forwardToCommand(
  query: string,
  method: "GET" | "POST",
  body?: unknown,
) {
  const accessToken = await getAccessToken();
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return failure("Entre na sua conta para continuar.", 401);

  try {
    const response = await fetch(
      `${config.url}/functions/v1/session-journey-themes-command${query}`,
      {
        body: method === "POST" ? JSON.stringify(body) : undefined,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        method,
      },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Não foi possível registrar os temas agora.", 503);
  }
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("tes_therapist_access_token")?.value ?? null;
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
