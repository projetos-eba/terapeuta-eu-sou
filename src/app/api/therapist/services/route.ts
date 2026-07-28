import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  parseTherapistServicesCommand,
  TherapistServicesContractError,
} from "@/features/therapist-services";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("Envie os dados em formato valido.", 400);
  }

  let command: ReturnType<typeof parseTherapistServicesCommand>;

  try {
    command = parseTherapistServicesCommand(rawBody);
  } catch (error) {
    if (error instanceof TherapistServicesContractError) {
      return failure("Revise os dados do servico.", 422);
    }
    return failure("Nao foi possivel validar o servico.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/therapist-services-command`,
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

    if (response.ok && isMutatingAction(command.action)) {
      revalidateTag("therapist-profile");
      revalidatePath("/terapeutas");
      revalidatePath("/terapeutas/[slug]", "page");
    }

    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Nao foi possivel atualizar os servicos agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}

function isMutatingAction(action: string) {
  return !["catalog", "list"].includes(action);
}
