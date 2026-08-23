import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizePlainText } from "@/features/support/support-contracts";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ ticketId: string }> };
type SupabaseUser = { id: string };
type ProfileRow = { role: "admin" | "patient" | "therapist" };
type TicketRow = {
  booking_id: string | null;
  category: string;
  created_at: string;
  description: string | null;
  id: string;
  last_activity_at: string;
  resolved_at: string | null;
  status: string;
  subject: string;
};
type MessageRow = {
  author_role: "admin" | "patient" | "therapist";
  body: string;
  created_at: string;
  id: string;
};
type TicketMessageResponse = Omit<MessageRow, "author_role"> & {
  author_role: "admin" | "patient" | "requester" | "therapist";
};
type RequesterRole = "patient" | "therapist";

export async function GET(request: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);

  const context = await getContext(
    readRole(new URL(request.url).searchParams.get("role")),
  );
  if (!context.ok) return failure(context.message, context.status);

  try {
    const tickets = await requestSupabase<TicketRow[]>(
      context.config,
      context.accessToken,
      `/rest/v1/support_tickets?select=id,booking_id,category,subject,description,status,created_at,last_activity_at,resolved_at&id=eq.${ticketId}&limit=1`,
    );
    const ticket = tickets[0];
    if (!ticket) return failure("Chamado não encontrado.", 404);

    const persistedMessages = await requestSupabase<MessageRow[]>(
      context.config,
      context.accessToken,
      `/rest/v1/support_ticket_messages?select=id,author_role,body,created_at&ticket_id=eq.${ticketId}&visibility=eq.requester&order=created_at.asc`,
    );

    const messages: TicketMessageResponse[] = persistedMessages.length
      ? persistedMessages
      : ticket.description
        ? [
            {
              author_role: "requester",
              body: ticket.description,
              created_at: ticket.created_at,
              id: `legacy-initial:${ticket.id}`,
            },
          ]
        : [];

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          bookingId: ticket.booking_id,
          category: ticket.category,
          createdAt: ticket.created_at,
          id: ticket.id,
          lastActivityAt: ticket.last_activity_at,
          messages,
          protocol: ticket.id.slice(0, 8).toUpperCase(),
          resolvedAt: ticket.resolved_at,
          status: ticket.status,
          subject: ticket.subject,
        },
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível carregar este chamado agora.", 503);
  }
}

export async function POST(request: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }
  const parsed = parseMessage(payload);
  if (!parsed.ok) return failure(parsed.message, 422);

  const context = await getContext(parsed.actorRole);
  if (!context.ok) return failure(context.message, context.status);

  try {
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/send_support_ticket_requester_message_v1`,
      {
        body: JSON.stringify({
          p_body: parsed.body,
          p_request_id: parsed.requestId,
          p_ticket_id: ticketId,
        }),
        cache: "no-store",
        headers: {
          apikey: context.config.apiKey,
          Authorization: `Bearer ${context.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok)
      return rpcFailure(await response.json().catch(() => null));

    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch {
    return failure("Não foi possível enviar sua resposta agora.", 503);
  }
}

function parseMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, message: "Revise sua resposta." };
  }
  const requestId = Reflect.get(value, "requestId");
  const body = Reflect.get(value, "body");
  const actorRole = readRole(Reflect.get(value, "actorRole"));
  if (typeof requestId !== "string" || !UUID.test(requestId)) {
    return { ok: false as const, message: "Requisição inválida." };
  }
  const normalized = normalizePlainText(body, true);
  if (!normalized || normalized.length > 4000) {
    return { ok: false as const, message: "Revise sua resposta." };
  }
  return { actorRole, body: normalized, ok: true as const, requestId };
}

async function getContext(role: RequesterRole | null) {
  const cookieStore = await cookies();
  const resolvedRole = role ?? getSoleSessionRole(cookieStore);
  const accessToken = resolvedRole
    ? cookieStore.get(`tes_${resolvedRole}_access_token`)?.value
    : undefined;
  const config = getSupabasePublicConfig();
  if (!resolvedRole || !config || !accessToken)
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  try {
    const user = await requestSupabase<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const profiles = await requestSupabase<ProfileRow[]>(
      config,
      accessToken,
      `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    if (profiles[0]?.role !== resolvedRole)
      return {
        ok: false as const,
        message: "Acesso de paciente ou terapeuta necessário.",
        status: 403,
      };
    return { accessToken, config, ok: true as const };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
}

function readRole(value: unknown): RequesterRole | null {
  return value === "patient" || value === "therapist" ? value : null;
}

function getSoleSessionRole(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const roles = (["patient", "therapist"] as const).filter((role) =>
    Boolean(cookieStore.get(`tes_${role}_access_token`)?.value),
  );
  return roles.length === 1 ? roles[0] : null;
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: { apikey: config.apiKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Support request failed");
  return (await response.json()) as T;
}

function rpcFailure(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;
  if (code === "22023")
    return failure(
      "Este chamado não está disponível para nova resposta agora.",
      422,
    );
  if (code === "42501")
    return failure("Você não pode responder este chamado.", 403);
  if (code === "P0001")
    return failure("Aguarde um momento antes de enviar outra resposta.", 429);
  return failure("Não foi possível enviar sua resposta agora.", 503);
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
