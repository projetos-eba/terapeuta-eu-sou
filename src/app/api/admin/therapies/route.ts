import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  canUseAdminPermission,
  type AdminPermission,
} from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
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

  const permission = permissionForCommand(body);
  const session = await readAdminApiSession(config, accessToken);

  if (!session || !canUseAdminPermission(session.permissions, permission)) {
    return failure("Acesso administrativo necessário.", 403);
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

async function readAdminApiSession(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  try {
    return await readAdminSessionFromAccessToken(config, accessToken);
  } catch {
    return null;
  }
}

function permissionForCommand(value: unknown): AdminPermission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "admin.therapies.manage";
  }

  const action = (value as Record<string, unknown>).action;

  if (
    action === "list" ||
    action === "impact" ||
    action === "requestList" ||
    action === "requestSign"
  ) {
    return "admin.therapies.read";
  }

  if (action === "matchingList") {
    return "admin.matching.read";
  }

  if (
    action === "matchingSaveTheme" ||
    action === "matchingSaveInterest" ||
    action === "matchingTransition"
  ) {
    return "admin.matching.manage";
  }

  return "admin.therapies.manage";
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
  return action !== "list" && action !== "matchingList" && action !== "impact" && action !== "requestList" && action !== "requestSign";
}

function revalidateTherapyCatalogSurfaces() {
  for (const tag of [
    "public-home",
    "therapies",
    "matching-config",
    "therapist-profile",
    "therapist-search",
  ]) {
    revalidateTag(tag);
  }

  revalidatePath("/terapias");
  revalidatePath("/terapias/[slug]", "page");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/terapeutas");
  revalidatePath("/terapeutas/[slug]", "page");
  revalidatePath("/sua-jornada");
  revalidatePath("/sua-jornada/resultado");
}
