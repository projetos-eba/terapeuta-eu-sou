import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const config = getSupabasePublicConfig();
  const token = (await cookies()).get("tes_admin_access_token")?.value;
  if (!body || !config || !token) return NextResponse.json({ ok: false, error: { message: "Entre com uma conta administrativa para continuar." } }, { status: 401 });
  const session = await readAdminSessionFromAccessToken(config, token).catch(() => null);
  const action = typeof body === "object" && body && "action" in body ? (body as { action?: unknown }).action : null;
  const permission = action === "list" || action === "get" || action === "preview" ? "admin.settings.read" : "admin.settings.manage";
  if (!session || !canUseAdminPermission(session.permissions, permission)) return NextResponse.json({ ok: false, error: { message: "Acesso administrativo necessário." } }, { status: 403 });
  const response = await fetch(`${config.url}/functions/v1/admin-email-management-command`, { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return NextResponse.json(await response.json().catch(() => ({ ok: false })), { status: response.status, headers: { "Cache-Control": "no-store" } });
}
