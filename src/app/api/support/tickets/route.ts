import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupportTemplateByKey } from "@/features/message-center/message-center.templates";
import type { MessageCenterActorRole } from "@/features/message-center/message-center.types";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseUser = {
  id: string;
};

type SupportTicketRow = {
  id: string;
  status: string;
};

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if (!parsed.ok) return failure(parsed.message, parsed.status);

  const config = getSupabasePublicConfig();
  const accessToken = await getAccessToken(parsed.actorRole);
  if (!config || !accessToken) return failure("Entre na sua conta.", 401);

  const template = getSupportTemplateByKey(parsed.templateKey);
  if (!template) return failure("Categoria de suporte inválida.", 422);

  try {
    const user = await supabaseRequest<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    if (parsed.bookingId) {
      const bookings = await supabaseRequest<Array<{ id: string }>>(
        config,
        accessToken,
        `/rest/v1/bookings?select=id&id=eq.${encodeURIComponent(parsed.bookingId)}&limit=1`,
      );

      if (!bookings[0]) {
        return failure("Não foi possível vincular este encontro.", 403);
      }
    }

    const correlationId = crypto.randomUUID();
    const response = await fetch(
      `${config.url}/rest/v1/support_tickets?on_conflict=requester_profile_id,request_id`,
      {
        body: JSON.stringify({
          booking_id: parsed.bookingId,
          category: template.category,
          correlation_id: correlationId,
          description: template.body,
          diagnostic_context: {
            actorRole: parsed.actorRole,
            source: parsed.source,
            templateKey: template.key,
            userAgent: "not_stored",
          },
          priority: getPriority(template.key),
          request_id: parsed.requestId,
          requester_profile_id: user.id,
          source: parsed.source,
          subject: template.label,
          urgency: getUrgency(template.key),
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      return failure("Não foi possível abrir o chamado agora.", 403);
    }

    const rows = (await response.json()) as SupportTicketRow[];
    const ticket = rows[0];
    if (!ticket) return failure("Não foi possível confirmar o protocolo.", 502);

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          id: ticket.id,
          protocol: ticket.id.slice(0, 8).toUpperCase(),
          status: ticket.status,
        },
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível abrir o chamado agora.", 503);
  }
}

async function getAccessToken(actorRole: MessageCenterActorRole) {
  const cookieStore = await cookies();
  const cookieName =
    actorRole === "patient"
      ? "tes_patient_access_token"
      : "tes_therapist_access_token";

  return cookieStore.get(cookieName)?.value ?? null;
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
    return { ok: false as const, message: "Revise o chamado.", status: 422 };
  }

  const actorRole = Reflect.get(body, "actorRole");
  const bookingId = Reflect.get(body, "bookingId");
  const requestId = Reflect.get(body, "requestId");
  const source = Reflect.get(body, "source");
  const templateKey = Reflect.get(body, "templateKey");

  if (actorRole !== "patient" && actorRole !== "therapist") {
    return { ok: false as const, message: "Perfil inválido.", status: 422 };
  }

  if (typeof requestId !== "string" || !UUID.test(requestId)) {
    return { ok: false as const, message: "Requisição inválida.", status: 422 };
  }

  if (typeof templateKey !== "string" || !templateKey) {
    return { ok: false as const, message: "Categoria inválida.", status: 422 };
  }

  if (
    bookingId !== null &&
    bookingId !== undefined &&
    (typeof bookingId !== "string" || !UUID.test(bookingId))
  ) {
    return { ok: false as const, message: "Encontro inválido.", status: 422 };
  }

  const safeSource =
    source === "encounter_detail" ||
    source === "waiting_room" ||
    source === "public_help"
      ? source
      : "message_center";

  return {
    actorRole,
    bookingId: typeof bookingId === "string" ? bookingId : null,
    ok: true as const,
    requestId,
    source: safeSource,
    templateKey,
  };
}

function getPriority(templateKey: string) {
  if (templateKey.includes("access")) return "high";
  if (templateKey.includes("payment") || templateKey.includes("finance")) {
    return "high";
  }

  return "normal";
}

function getUrgency(templateKey: string) {
  if (templateKey.includes("access")) return "high";
  return "normal";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
