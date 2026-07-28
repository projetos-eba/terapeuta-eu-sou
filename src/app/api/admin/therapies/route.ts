import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato valido.", 400);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/admin-therapy-catalog-command`,
      {
        body: JSON.stringify(body),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (response.ok && isMutatingAction(body)) {
      revalidateTherapyCatalogSurfaces();
    }

    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Nao foi possivel atualizar o catalogo agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}

function isMutatingAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = (value as Record<string, unknown>).action;
  return action !== "list" && action !== "impact";
}

function revalidateTherapyCatalogSurfaces() {
  for (const tag of [
    "therapies",
    "matching-config",
    "therapist-profile",
    "therapist-search",
  ]) {
    revalidateTag(tag);
  }

  revalidatePath("/terapias");
  revalidatePath("/terapias/[slug]", "page");
  revalidatePath("/terapeutas");
  revalidatePath("/terapeutas/[slug]", "page");
  revalidatePath("/sua-jornada");
  revalidatePath("/sua-jornada/resultado");
}
