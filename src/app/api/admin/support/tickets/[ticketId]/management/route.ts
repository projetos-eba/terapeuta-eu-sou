import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = [
  "assign_self",
  "unassign",
  "set_priority",
  "start",
  "resolve",
  "reopen",
] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const noStoreHeaders = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ ticketId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);
  const context = await getContext();
  if (!context.ok) return failure(context.message, context.status);

  try {
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/admin_get_support_ticket_management_v1`,
      {
        body: JSON.stringify({ p_ticket_id: ticketId }),
        cache: "no-store",
        headers: {
          apikey: context.config.apiKey,
          Authorization: `Bearer ${context.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok)
      return failure(
        response.status === 404
          ? "Chamado não encontrado."
          : "Não foi possível carregar a gestão do chamado agora.",
        response.status === 404 ? 404 : 503,
      );
    return NextResponse.json(
      { data: await response.json(), ok: true },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível carregar a gestão do chamado agora.", 503);
  }
}

export async function POST(request: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return failure("Revise a ação administrativa.", 422);
  const action = Reflect.get(payload, "action");
  const requestId = Reflect.get(payload, "requestId");
  const priority = Reflect.get(payload, "priority");
  if (
    typeof action !== "string" ||
    !actions.includes(action as (typeof actions)[number]) ||
    typeof requestId !== "string" ||
    !UUID.test(requestId)
  ) {
    return failure("Revise a ação administrativa.", 422);
  }
  if (
    action === "set_priority" &&
    (typeof priority !== "string" ||
      !priorities.includes(priority as (typeof priorities)[number]))
  ) {
    return failure("Selecione uma prioridade válida.", 422);
  }
  if (action !== "set_priority" && priority !== undefined)
    return failure("Revise a ação administrativa.", 422);

  const context = await getContext();
  if (!context.ok) return failure(context.message, context.status);
  try {
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/admin_manage_support_ticket_v1`,
      {
        body: JSON.stringify({
          p_action: action,
          p_priority: action === "set_priority" ? priority : null,
          p_request_id: requestId,
          p_ticket_id: ticketId,
        }),
        cache: "no-store",
        headers: {
          apikey: context.config.apiKey,
          Authorization: `Bearer ${context.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok)
      return failure(
        "Não foi possível atualizar o chamado agora.",
        response.status === 404 ? 404 : response.status === 422 ? 422 : 503,
      );
    revalidatePath(routes.admin.support);
    revalidatePath(routes.admin.supportDetail(ticketId));
    return NextResponse.json(
      { data: await response.json(), ok: true },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível atualizar o chamado agora.", 503);
  }
}

async function getContext() {
  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken)
    return {
      message: "Entre com uma conta administrativa para continuar.",
      ok: false as const,
      status: 401,
    };
  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (
    !session ||
    !canUseAdminPermission(session.permissions, "admin.support.manage")
  )
    return {
      message: "Acesso administrativo necessário.",
      ok: false as const,
      status: 403,
    };
  return { accessToken, config, ok: true as const };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
