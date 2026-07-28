import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getParticipantTemplates } from "@/features/message-center/message-center.templates";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseUser = {
  id: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  const parsed = parseBody(body);
  if (!parsed) return failure("Revise o template selecionado.", 422);

  const template = getParticipantTemplates(parsed.actorRole).find(
    (item) => item.key === parsed.templateKey,
  );
  if (!template) return failure("Template indisponível.", 422);

  const config = getSupabasePublicConfig();
  const accessToken = await getActorAccessToken(parsed.actorRole);

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  try {
    const user = await supabaseRequest<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const response = await fetch(`${config.url}/rest/v1/messages`, {
      body: JSON.stringify({
        body: template.body,
        conversation_id: parsed.conversationId,
        sender_profile_id: user.id,
      }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      method: "POST",
    });

    if (!response.ok) {
      return failure("Não foi possível enviar este template agora.", 403);
    }

    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch {
    return failure("Não foi possível enviar este template agora.", 503);
  }
}

async function getActorAccessToken(actorRole: "patient" | "therapist") {
  const cookieStore = await cookies();
  return (
    cookieStore.get(
      actorRole === "patient"
        ? "tes_patient_access_token"
        : "tes_therapist_access_token",
    )?.value ?? null
  );
}

async function supabaseRequest<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
): Promise<T> {
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

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const actorRole = Reflect.get(value, "actorRole");
  const conversationId = Reflect.get(value, "conversationId");
  const templateKey = Reflect.get(value, "templateKey");

  if (
    (actorRole !== "patient" && actorRole !== "therapist") ||
    typeof conversationId !== "string" ||
    !UUID.test(conversationId) ||
    typeof templateKey !== "string"
  ) {
    return null;
  }

  return { actorRole, conversationId, templateKey };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
