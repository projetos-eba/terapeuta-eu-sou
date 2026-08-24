import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_patient_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  if (!isValidPasswordPayload(body)) {
    return failure("Use pelo menos 8 caracteres e confirme a nova senha.", 422);
  }

  try {
    const result = await invokeSupabaseFunction(config, "patient-account-command", {
      accessToken,
      body: { action: "change_password", payload: body },
    });
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return failure(
      error instanceof SupabaseFunctionError && error.status < 500
        ? "Não foi possível alterar sua senha."
        : "Não foi possível alterar sua senha agora.",
      error instanceof SupabaseFunctionError ? error.status : 503,
    );
  }
}

function isValidPasswordPayload(value: unknown): value is {
  confirmPassword: string;
  password: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.password === "string" &&
    payload.password.length >= 8 &&
    typeof payload.confirmPassword === "string" &&
    payload.password === payload.confirmPassword
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}
