import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseUser = {
  id: string;
};

type ProfileRow = {
  role: "admin" | "patient" | "therapist";
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
    const profiles = await supabaseRequest<ProfileRow[]>(
      config,
      accessToken,
      `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    if (profiles[0]?.role !== parsed.actorRole) {
      return failure("A sessão não corresponde ao perfil selecionado.", 403);
    }

    const response = await fetch(
      `${config.url}/rest/v1/rpc/send_structured_participant_message_v1`,
      {
      body: JSON.stringify({
          p_conversation_id: parsed.conversationId,
          p_template_key: parsed.templateKey,
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
      const error = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      if (error?.code === "22023") {
        return failure("Template indisponível para esta conversa.", 422);
      }
      if (error?.code === "42501") {
        return failure("Você não pode enviar para esta conversa.", 403);
      }
      return failure("Não foi possível enviar este template agora.", 503);
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

  for (const forbiddenKey of ["body", "description", "html", "message"]) {
    if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) return null;
  }

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
