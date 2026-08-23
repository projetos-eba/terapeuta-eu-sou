import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseUser = {
  id: string;
};
type NotificationRole = "admin" | "patient" | "therapist";

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if (!parsed.ok) return failure(parsed.message, parsed.status);

  const config = getSupabasePublicConfig();
  const accessToken = await getAccessToken(parsed.role);

  if (!parsed.role || !config || !accessToken) return failure("Entre na sua conta.", 401);

  try {
    const user = await supabaseRequest<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const filter =
      parsed.scope === "all"
        ? `profile_id=eq.${user.id}&read_at=is.null`
        : `profile_id=eq.${user.id}&id=in.(${parsed.ids.join(",")})`;
    const response = await fetch(
      `${config.url}/rest/v1/notifications?${filter}`,
      {
        body: JSON.stringify({ read_at: new Date().toISOString() }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      return failure("Não foi possível atualizar notificações.", 403);
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return failure("Não foi possível atualizar notificações agora.", 503);
  }
}

async function getAccessToken(role: NotificationRole | null) {
  const cookieStore = await cookies();
  return role
    ? cookieStore.get(`tes_${role}_access_token`)?.value ?? null
    : null;
}

async function supabaseRequest<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Supabase request failed.");

  return (await response.json()) as T;
}

async function parseBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false as const, message: "Envie JSON válido.", status: 400 };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false as const,
      message: "Revise a notificação.",
      status: 422,
    };
  }

  const markAll = Reflect.get(body, "markAll");
  const role = Reflect.get(body, "role");
  if (role !== "admin" && role !== "patient" && role !== "therapist") {
    return {
      ok: false as const,
      message: "NÃ£o foi possÃ­vel identificar sua Ã¡rea.",
      status: 422,
    };
  }
  if (markAll === true) {
    return { ok: true as const, role, scope: "all" as const };
  }

  const ids = Reflect.get(body, "ids");
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 50 ||
    !ids.every((id) => typeof id === "string" && UUID.test(id))
  ) {
    return {
      ok: false as const,
      message: "Selecione notificações válidas.",
      status: 422,
    };
  }

  return {
    ids: [...new Set(ids)],
    ok: true as const,
    role,
    scope: "ids" as const,
  };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
