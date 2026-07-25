import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
} from "@/lib/supabase/edge-functions";

const PUBLIC_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.";

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return safeResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return safeResponse();
  }

  const email = getString(body, "email").trim().toLowerCase();

  try {
    await invokeSupabaseFunction(config, "request-password-reset", {
      body: { email },
    });
  } catch {
    // Keep the same public response to avoid account enumeration.
  }

  return safeResponse();
}

function getString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeResponse() {
  const response = NextResponse.json({ ok: true, message: PUBLIC_MESSAGE });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
