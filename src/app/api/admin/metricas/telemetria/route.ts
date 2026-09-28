import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const input = await parseInput(request);
  if (!input.ok) return failure(input.message, input.status);

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }

  try {
    const session = await readAdminSessionFromAccessToken(config, accessToken);
    if (
      !session ||
      !canUseAdminPermission(session.permissions, "admin.settings.manage")
    ) {
      return failure("Você não tem permissão para esta ação.", 403);
    }

    const response = await fetch(
      `${config.url}/functions/v1/admin-therapist-metrics-command`,
      {
        body: JSON.stringify(input.value),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      data?: { enabled?: boolean };
      error?: { message?: string };
      ok?: boolean;
    } | null;

    if (!response.ok || !payload?.ok) {
      return failure(
        payload?.error?.message ?? "Não foi possível atualizar a coleta agora.",
        response.status >= 400 && response.status < 500 ? response.status : 503,
      );
    }

    revalidatePath(routes.admin.security);
    revalidatePath(routes.admin.settings);
    return NextResponse.json(
      { enabled: payload.data?.enabled === true, ok: true },
      { headers: noStore },
    );
  } catch {
    return failure("Não foi possível atualizar a coleta agora.", 503);
  }
}

async function parseInput(request: Request): Promise<
  | { ok: true; value: { enabled: boolean; reason: string; requestId: string } }
  | { message: string; ok: false; status: number }
> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Revise os dados enviados.", ok: false, status: 400 };
  }

  const record = body as Record<string, unknown>;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  const requestId =
    typeof record.requestId === "string" ? record.requestId.trim() : "";

  if (
    typeof record.enabled !== "boolean" ||
    reason.length < 8 ||
    reason.length > 500 ||
    !UUID_PATTERN.test(requestId)
  ) {
    return {
      message: "Informe uma justificativa entre 8 e 500 caracteres.",
      ok: false,
      status: 422,
    };
  }

  return {
    ok: true,
    value: { enabled: record.enabled, reason, requestId },
  };
}

function failure(message: string, status: number) {
  return NextResponse.json({ message, ok: false }, { headers: noStore, status });
}
