import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return safeError("Não foi possível verificar a confirmação.", 503);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return safeError("Envie os dados em formato válido.", 400);
  }

  const statusToken = getString(body, "statusToken").trim();

  if (!statusToken) {
    return safeError("Não foi possível verificar a confirmação.", 422);
  }

  try {
    const result = await invokeSupabaseFunction<{
      confirmed?: boolean;
      destination?: string | null;
      ok: boolean;
    }>(config, "check-email-verification-status", {
      body: { statusToken },
    });

    if (!result.ok) {
      return safeError("Não foi possível verificar a confirmação.", 200);
    }

    return noStoreJson({
      confirmed: Boolean(result.confirmed),
      destination: result.destination ?? null,
      ok: true,
    });
  } catch (error) {
    return safeError(
      "Não foi possível verificar a confirmação.",
      error instanceof SupabaseFunctionError ? 200 : 500,
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
