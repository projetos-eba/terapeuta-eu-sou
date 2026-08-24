import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return failure("Envie um contexto válido.", 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failure("Revise a conversa selecionada.", 422);
  }
  const actorRole = Reflect.get(input, "actorRole");
  const conversationId = Reflect.get(input, "conversationId");
  if (
    (actorRole !== "patient" && actorRole !== "therapist") ||
    typeof conversationId !== "string" ||
    !UUID.test(conversationId)
  ) {
    return failure("Revise a conversa selecionada.", 422);
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get(
    `tes_${actorRole}_access_token`,
  )?.value;
  if (!config || !accessToken) return failure("Entre na sua conta.", 401);

  try {
    const userResponse = await fetch(`${config.url}/auth/v1/user`, {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!userResponse.ok) return failure("Entre na sua conta.", 401);
    const user = (await userResponse.json()) as { id?: string };
    if (!user.id) return failure("Entre na sua conta.", 401);

    const response = await fetch(
      `${config.url}/rest/v1/messages?conversation_id=eq.${conversationId}&sender_profile_id=neq.${encodeURIComponent(user.id)}&read_at=is.null`,
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
    if (!response.ok)
      return failure("Não foi possível atualizar a conversa.", 503);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure("Não foi possível atualizar a conversa agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
