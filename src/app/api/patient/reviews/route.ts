import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const therapistProfileId = new URL(request.url).searchParams.get(
    "therapistProfileId",
  );
  if (!isUuid(therapistProfileId)) return failure("Terapeuta inválido.", 422);

  const accessToken = await getAccessToken();
  const config = getSupabasePublicConfig();
  if (!accessToken || !config) return failure("Entre na sua conta para continuar.", 401);

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/get_patient_therapist_review_v1`,
      {
        body: JSON.stringify({ p_therapist_profile_id: therapistProfileId }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) return failure("Não foi possível consultar a avaliação.", 503);
    return NextResponse.json({ data: payload, ok: true }, { headers: noStoreHeaders });
  } catch {
    return failure("Não foi possível consultar a avaliação.", 503);
  }
}

export async function POST(request: Request) {
  const accessToken = await getAccessToken();
  const config = getSupabasePublicConfig();
  if (!accessToken || !config) return failure("Entre na sua conta para continuar.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  try {
    const response = await fetch(`${config.url}/functions/v1/patient-reviews-command`, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Não foi possível atualizar a avaliação agora.", 503);
  }
}

async function getAccessToken() {
  return (await cookies()).get("tes_patient_access_token")?.value ?? null;
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
