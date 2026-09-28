import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: { bookingId?: string; reason?: string; requestId?: string };

  try {
    body = await request.json();
  } catch {
    return failure("Revise os dados enviados.", 400);
  }

  const reason = body.reason?.trim() ?? "";
  if (
    !UUID_PATTERN.test(body.bookingId ?? "") ||
    !UUID_PATTERN.test(body.requestId ?? "") ||
    reason.length < 8 ||
    reason.length > 500
  ) {
    return failure(
      "Informe uma justificativa entre 8 e 500 caracteres.",
      422,
    );
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre na conta administrativa para continuar.", 401);
  }

  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (
    !session ||
    !canUseAdminPermission(session.permissions, "admin.sessions.manage")
  ) {
    return failure("Você não tem permissão para esta ação.", 403);
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_cancel_uncharged_session_v10`,
      {
        body: JSON.stringify({
          p_booking_id: body.bookingId,
          p_reason: reason,
          p_request_id: body.requestId,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const decision = (await response.json().catch(() => null)) as {
      bookingId?: string;
      canceled?: boolean;
    } | null;

    if (!response.ok || !decision?.bookingId || !decision.canceled) {
      return failure(mapFailure(decision), response.status);
    }

    revalidatePath(routes.admin.sessions);
    revalidatePath(routes.admin.sessionDetail(decision.bookingId));

    return NextResponse.json(
      { data: { bookingId: decision.bookingId }, ok: true },
      { headers: NO_STORE },
    );
  } catch {
    return failure("Não foi possível concluir o cancelamento agora.", 503);
  }
}

function mapFailure(value: unknown) {
  const message =
    value && typeof value === "object" && "message" in value
      ? String(value.message)
      : "";

  if (message.includes("FORBIDDEN")) {
    return "Você não tem permissão para esta ação.";
  }
  if (message.includes("NOT_AVAILABLE") || message.includes("PAYMENT_CHANGED")) {
    return "Esta sessão não está mais disponível para cancelamento antes da cobrança. Atualize a página para conferir a situação.";
  }
  return "Não foi possível cancelar esta sessão agora. Atualize a página para conferir a situação.";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { message, ok: false },
    { headers: NO_STORE, status },
  );
}
