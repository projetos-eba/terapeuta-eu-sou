import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parseTherapistProfileCommand,
  TherapistProfileContractError,
} from "@/features/therapist-profile-editor";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  let command: ReturnType<typeof parseTherapistProfileCommand>;

  try {
    command = parseTherapistProfileCommand(rawBody);
  } catch (error) {
    if (error instanceof TherapistProfileContractError) {
      return failure("Revise os dados do perfil.", 422);
    }
    return failure("Não foi possível validar o perfil.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/therapist-profile-command`,
      {
        body: JSON.stringify(command),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (response.ok && isPublicInvalidatingAction(command.action)) {
      revalidateTag("therapist-profile");
      revalidateTag("therapist-search");
      revalidatePath("/terapeutas");
      revalidatePath("/terapeutas/[slug]", "page");
      revalidatePath("/");
    }

    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Não foi possível atualizar o perfil agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}

function isPublicInvalidatingAction(action: string) {
  return action === "publish" || action === "unpublish";
}
