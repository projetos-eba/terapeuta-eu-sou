import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mapTherapistSettingsUpdateResult } from "@/features/therapist-settings/therapist-settings.mappers";
import {
  parseTherapistSettingsUpdatePayload,
  TherapistSettingsContractError,
} from "@/features/therapist-settings/therapist-settings.parsers";
import {
  TherapistSettingsQueryError,
  updateTherapistAccountSettings,
} from "@/features/therapist-settings/therapist-settings.queries";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

type SupabaseAuthUser = {
  id: string;
};

type ProfileRoleRow = {
  role: string;
};

export async function PATCH(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400, "VALIDATION_ERROR");
  }

  let payload: ReturnType<typeof parseTherapistSettingsUpdatePayload>;

  try {
    payload = parseTherapistSettingsUpdatePayload(rawBody);
  } catch (error) {
    if (error instanceof TherapistSettingsContractError) {
      return failure(
        "Revise os dados das configurações antes de continuar.",
        422,
        "VALIDATION_ERROR",
      );
    }
    return failure("Não foi possível validar as configurações.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401, "FORBIDDEN");
  }

  try {
    const user = await requestSupabase<SupabaseAuthUser>({
      accessToken,
      config,
      path: "/auth/v1/user",
    });
    const [profile] = await requestSupabase<ProfileRoleRow[]>({
      accessToken,
      config,
      path: `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(
        user.id,
      )}&limit=1`,
    });

    if (profile?.role !== "therapist") {
      return failure("Use uma conta de terapeuta para continuar.", 403, "FORBIDDEN");
    }

    const updated = await updateTherapistAccountSettings({
      accessToken,
      displayName: payload.displayName,
      phone: payload.phone,
      userId: user.id,
    });

    return NextResponse.json(
      {
        data: mapTherapistSettingsUpdateResult(updated),
        ok: true,
      },
      { headers: noStoreHeaders, status: 200 },
    );
  } catch (error) {
    if (error instanceof TherapistSettingsQueryError) {
      return failure(
        error.code === "forbidden"
          ? "Use uma conta de terapeuta para continuar."
          : "Não foi possível salvar as configurações agora.",
        error.code === "forbidden" ? 403 : 503,
        error.code === "forbidden" ? "FORBIDDEN" : "UNAVAILABLE",
      );
    }

    return failure(
      "Não foi possível salvar as configurações agora.",
      503,
      "UNAVAILABLE",
    );
  }
}

async function requestSupabase<T>({
  accessToken,
  config,
  path,
}: {
  accessToken: string;
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>;
  path: string;
}): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new TherapistSettingsQueryError(
      response.status === 401 || response.status === 403
        ? "forbidden"
        : "unavailable",
    );
  }

  return (await response.json()) as T;
}

function failure(message: string, status: number, code = "UNKNOWN") {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { headers: noStoreHeaders, status },
  );
}
