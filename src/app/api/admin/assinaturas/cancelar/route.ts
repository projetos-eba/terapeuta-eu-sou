import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: { reason?: string; requestId?: string; subscriptionId?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Revise os dados enviados.", 400);
  }

  if (
    !uuid.test(body.subscriptionId ?? "") ||
    !uuid.test(body.requestId ?? "") ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 20 ||
    body.reason.trim().length > 1000
  ) {
    return fail(
      "Informe o motivo da decisão com pelo menos 20 caracteres.",
      422,
    );
  }

  const config = getSupabasePublicConfig();
  const token = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !token) {
    return fail("Entre na conta administrativa para continuar.", 401);
  }

  try {
    const session = await readAdminSessionFromAccessToken(config, token);
    if (
      !session ||
      !canUseAdminPermission(session.permissions, "admin.subscriptions.manage")
    ) {
      return fail("Você não tem permissão para esta ação.", 403);
    }

    const response = await fetch(
      `${config.url}/functions/v1/admin-cancel-therapist-subscription`,
      {
        body: JSON.stringify({
          reason: body.reason.trim(),
          requestId: body.requestId,
          subscriptionId: body.subscriptionId,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      return fail(
        "Não foi possível programar o cancelamento agora. Confira a situação antes de tentar novamente.",
        response.status,
      );
    }

    const payload = (await response.json()) as { ok?: boolean };
    if (!payload.ok) {
      return fail(
        "Não foi possível programar o cancelamento agora. Confira a situação antes de tentar novamente.",
        502,
      );
    }

    revalidatePath(routes.admin.subscriptions);
    revalidatePath(routes.admin.subscriptionDetail(body.subscriptionId!));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail(
      "Não foi possível consultar a situação agora. Tente novamente mais tarde.",
      503,
    );
  }
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { message, ok: false },
    { headers: noStore, status },
  );
}
