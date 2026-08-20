import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return safeError("Não foi possível confirmar o e-mail agora.", 503);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return safeError("Envie os dados em formato válido.", 400);
  }

  const token = getString(body, "token").trim();

  if (!token) {
    return safeError("Link inválido ou expirado.", 422);
  }

  try {
    const result = await invokeSupabaseFunction<{
      ok: boolean;
      message?: string;
      redirectTo?: string;
    }>(config, "verify-email", { body: { token } });

    if (!result.ok) {
      return safeError(result.message ?? "Link inválido ou expirado.", 400);
    }

    return noStoreJson({
      ok: true,
      redirectTo: result.redirectTo,
    });
  } catch (error) {
    return safeError(
      error instanceof SupabaseFunctionError && error.status < 500
        ? "Link inválido ou expirado."
        : "Não foi possível confirmar o e-mail agora.",
      error instanceof SupabaseFunctionError ? error.status : 500,
    );
  }
}

function getString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeError(message: string, status: number) {
  return noStoreJson({ ok: false, message }, { status });
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
