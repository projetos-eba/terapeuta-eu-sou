import { NextResponse } from "next/server";

import { getPatientAccessToken } from "@/lib/auth/patient-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatientProfileRow = {
  id: string;
};

type SupabaseUser = {
  id: string;
};

export async function POST(request: Request) {
  const parsed = await parseTherapistPayload(request);
  if (!parsed.ok) return failure(parsed.message, parsed.status);

  return mutateFavorite(parsed.therapistProfileId, "add");
}

export async function DELETE(request: Request) {
  const parsed = await parseTherapistPayload(request);
  if (!parsed.ok) return failure(parsed.message, parsed.status);

  return mutateFavorite(parsed.therapistProfileId, "remove");
}

async function mutateFavorite(
  therapistProfileId: string,
  action: "add" | "remove",
) {
  const accessToken = await getPatientAccessToken();
  const config = getSupabasePublicConfig();

  if (!config || !accessToken) return failure("Entre na sua conta.", 401);

  try {
    const user = await supabaseRequest<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const patientProfile = await getPatientProfile(
      config,
      accessToken,
      user.id,
    );
    if (!patientProfile)
      return failure("Perfil de paciente não encontrado.", 404);

    if (action === "add") {
      const response = await fetch(
        `${config.url}/rest/v1/favorite_therapists?on_conflict=patient_profile_id,therapist_profile_id`,
        {
          body: JSON.stringify({
            patient_profile_id: patientProfile.id,
            therapist_profile_id: therapistProfileId,
          }),
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          method: "POST",
        },
      );

      if (!response.ok)
        return failure("Não foi possível salvar favorito.", 403);
    } else {
      const response = await fetch(
        `${config.url}/rest/v1/favorite_therapists?patient_profile_id=eq.${patientProfile.id}&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}`,
        {
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
          },
          method: "DELETE",
        },
      );

      if (!response.ok)
        return failure("Não foi possível remover favorito.", 403);
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return failure("Não foi possível atualizar favoritos agora.", 503);
  }
}

async function getPatientProfile(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  profileId: string,
) {
  const response = await fetch(
    `${config.url}/rest/v1/patient_profiles?select=id&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) throw new Error("Failed to read patient profile.");

  const rows = (await response.json()) as PatientProfileRow[];
  return rows[0] ?? null;
}

async function supabaseRequest<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Supabase request failed.");

  return (await response.json()) as T;
}

async function parseTherapistPayload(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false as const, message: "Envie JSON válido.", status: 400 };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const, message: "Revise o favorito.", status: 422 };
  }

  const therapistProfileId = Reflect.get(body, "therapistProfileId");
  if (
    typeof therapistProfileId !== "string" ||
    !UUID.test(therapistProfileId)
  ) {
    return { ok: false as const, message: "Terapeuta inválido.", status: 422 };
  }

  return { ok: true as const, therapistProfileId };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
