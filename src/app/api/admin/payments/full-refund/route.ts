import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: { paymentId?: string; requestId?: string; reason?: string };
  try { body = await request.json(); }
  catch { return fail("Revise os dados enviados.", 400); }
  if (!uuid.test(body.paymentId ?? "") || !uuid.test(body.requestId ?? "") ||
    typeof body.reason !== "string" || body.reason.trim().length < 20 ||
    body.reason.trim().length > 1000) {
    return fail("Informe o motivo da decisão com pelo menos 20 caracteres.", 422);
  }
  const config = getSupabasePublicConfig();
  const token = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !token) return fail("Entre na conta administrativa para continuar.", 401);
  try {
    const session = await readAdminSessionFromAccessToken(config, token);
    if (!session || !canUseAdminPermission(session.permissions, "admin.payments.refund")) {
      return fail("Você não tem permissão para esta ação.", 403);
    }
    const response = await fetch(`${config.url}/functions/v1/admin-full-session-refund-v10`, {
      method: "POST", cache: "no-store",
      headers: { apikey: config.apiKey, Authorization: `Bearer ${token}`,
        "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: body.paymentId, requestId: body.requestId,
        reason: body.reason.trim() }),
    });
    if (!response.ok) return fail("Não foi possível concluir a análise agora. Verifique o andamento antes de tentar novamente.", response.status);
    const payload = await response.json() as {
      ok?: boolean; data?: { status?: string };
    };
    revalidatePath(`/admin/pagamentos/${body.paymentId}`);
    revalidatePath("/admin/pagamentos");
    return NextResponse.json({ ok: payload.ok === true,
      status: payload.data?.status ?? "needs_review" }, { headers: noStore });
  } catch {
    return fail("Não foi possível consultar a situação agora. Tente novamente mais tarde.", 503);
  }
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: noStore });
}
