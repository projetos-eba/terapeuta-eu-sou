import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ ticketId: string }> };
type ThreadMessage = {
  author_role: "admin" | "patient" | "therapist";
  body: string;
  created_at: string;
  id: string;
  visibility: "internal" | "requester";
};

export async function GET(_: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);

  const context = await getAdminSupportContext("admin.support.read");
  if (!context.ok) return failure(context.message, context.status);

  try {
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/admin_get_support_ticket_thread_v1`,
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

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      return failure(
        payload?.code === "P0002"
          ? "Chamado não encontrado."
          : "Não foi possível carregar a conversa agora.",
        payload?.code === "P0002" ? 404 : 503,
      );
    }

    const messages = (await response.json()) as ThreadMessage[];
    return NextResponse.json(
      { ok: true, messages },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível carregar a conversa agora.", 503);
  }
}

async function getAdminSupportContext(
  permission: "admin.support.manage" | "admin.support.read",
) {
  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return {
      message: "Entre com uma conta administrativa para continuar.",
      ok: false as const,
      status: 401,
    };
  }

  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (!session || !canUseAdminPermission(session.permissions, permission)) {
    return {
      message: "Acesso administrativo necessário.",
      ok: false as const,
      status: 403,
    };
  }

  return { accessToken, config, ok: true as const };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
