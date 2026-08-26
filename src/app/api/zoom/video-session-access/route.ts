import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UPSTREAM_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  let body: unknown;

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "Origem da requisicao invalida." },
      { headers: noStoreHeaders, status: 403 },
    );
  }

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
  const actorRole = isRecord(body) ? body.actorRole : null;

  if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return NextResponse.json(
      { ok: false, message: "Sessao invalida." },
      { headers: noStoreHeaders, status: 422 },
    );
  }
  if (
    intent !== null &&
    intent !== "join" &&
    intent !== "preview" &&
    intent !== "end"
  ) {
    return NextResponse.json(
      { ok: false, message: "Acao de acesso invalida." },
      { headers: noStoreHeaders, status: 422 },
    );
  }
  if (
    actorRole !== null &&
    actorRole !== "patient" &&
    actorRole !== "therapist"
  ) {
    return NextResponse.json(
      { ok: false, message: "Perfil de acesso invalido." },
      { headers: noStoreHeaders, status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  const accessToken = await getAvailableAccessToken(actorRole);

  if (!config || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "Entre na sua conta para continuar." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(
      `${config.url}/functions/v1/zoom-video-session-access`,
      {
        body: JSON.stringify({ actorRole, bookingId, intent: intent ?? "join" }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "A sala demorou mais que o esperado para responder. Tente novamente.",
        },
        { headers: noStoreHeaders, status: 504 },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload ?? { ok: false }, {
    headers: noStoreHeaders,
    status: response.status,
  });
}

const noStoreHeaders = { "Cache-Control": "no-store" };

async function getAvailableAccessToken(
  actorRole: "patient" | "therapist" | null,
) {
  const cookieStore = await cookies();

  if (actorRole === "therapist") {
    return cookieStore.get("tes_therapist_access_token")?.value ?? null;
  }

  if (actorRole === "patient") {
    return cookieStore.get("tes_patient_access_token")?.value ?? null;
  }

  return (
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_patient_access_token")?.value ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
