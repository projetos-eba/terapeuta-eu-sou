import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizePlainText } from "@/features/support/support-contracts";
import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ ticketId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failure("Revise a nota interna.", 422);
  }
  const body = normalizePlainText(Reflect.get(input, "body"), true);
  const requestId = Reflect.get(input, "requestId");
  if (
    !body ||
    body.length > 4000 ||
    typeof requestId !== "string" ||
    !UUID.test(requestId)
  ) {
    return failure("Revise a nota interna.", 422);
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }
  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (
    !session ||
    !canUseAdminPermission(session.permissions, "admin.support.manage")
  ) {
    return failure("Acesso administrativo necessário.", 403);
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_add_support_ticket_note_v1`,
      {
        body: JSON.stringify({
          p_body: body,
          p_request_id: requestId,
          p_ticket_id: ticketId,
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
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      return failure(
        payload?.code === "P0002"
          ? "Chamado não encontrado."
          : "Não foi possível salvar a nota interna agora.",
        payload?.code === "P0002" ? 404 : 503,
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch {
    return failure("Não foi possível salvar a nota interna agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
