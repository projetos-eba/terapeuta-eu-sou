import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parsePatientAccountUpdatePayload,
  PatientAccountContractError,
} from "@/features/patient-account/patient-account.parsers";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function PATCH(request: Request) {
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

  try {
    const payload = parsePatientAccountUpdatePayload(body);
    const result = await invokeSupabaseFunction(config, "patient-account-command", {
      accessToken,
      body: { action: "update_profile", payload },
    });
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof PatientAccountContractError) {
      return failure("Revise os dados antes de salvar.", 422);
    }
    return failure(
      error instanceof SupabaseFunctionError && error.status < 500
        ? "Não foi possível salvar esses dados."
        : "Não foi possível salvar seus dados agora.",
      error instanceof SupabaseFunctionError ? error.status : 503,
    );
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}
