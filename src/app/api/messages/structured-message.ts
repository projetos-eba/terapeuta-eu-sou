import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StructuredMessageRequest = {
  actorRole: "patient" | "therapist";
  bookingId?: string;
  conversationId: string;
  parameters: Record<string, string>;
  templateKey: string;
};

export function parseStructuredMessageBody(
  value: unknown,
): StructuredMessageRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = new Set([
    "actorRole",
    "bookingId",
    "conversationId",
    "parameters",
    "templateKey",
  ]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) return null;

  const candidate = value as Record<string, unknown>;
  const actorRole = candidate.actorRole;
  const conversationId = candidate.conversationId;
  const templateKey = candidate.templateKey;
  const bookingId = candidate.bookingId;
  const parameters = candidate.parameters;
  if (
    (actorRole !== "patient" && actorRole !== "therapist") ||
    typeof conversationId !== "string" ||
    !UUID.test(conversationId) ||
    typeof templateKey !== "string" ||
    templateKey.trim().length === 0 ||
    (bookingId !== undefined &&
      (typeof bookingId !== "string" || !UUID.test(bookingId))) ||
    (parameters !== undefined &&
      (!parameters ||
        typeof parameters !== "object" ||
        Array.isArray(parameters)))
  )
    return null;

  const normalized = Object.fromEntries(
    Object.entries(
      (parameters as Record<string, unknown> | undefined) ?? {},
    ).map(([key, item]) => [key, typeof item === "string" ? item : null]),
  );
  if (Object.values(normalized).some((item) => item === null)) return null;
  return {
    actorRole,
    bookingId: bookingId as string | undefined,
    conversationId,
    parameters: normalized as Record<string, string>,
    templateKey: templateKey.trim(),
  };
}

export async function getStructuredMessageSession(
  actorRole: StructuredMessageRequest["actorRole"],
) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(
    actorRole === "patient"
      ? "tes_patient_access_token"
      : "tes_therapist_access_token",
  )?.value;
  if (!config || !accessToken) return null;
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    cache: "no-store",
    headers: { apikey: config.apiKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return null;
  const profileResponse = await fetch(
    `${config.url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<{ role?: string }>;
  if (profiles[0]?.role !== actorRole) return { forbidden: true as const };
  return { accessToken, config };
}

export function structuredRpcErrorMessage(code: string | undefined) {
  if (code === "22023")
    return {
      message: "Revise a mensagem e o contexto selecionados.",
      status: 422,
    };
  if (code === "42501")
    return { message: "Você não pode enviar para esta conversa.", status: 403 };
  return { message: "Não foi possível concluir esta ação agora.", status: 503 };
}

export async function readRpcError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  return structuredRpcErrorMessage(payload?.code);
}
