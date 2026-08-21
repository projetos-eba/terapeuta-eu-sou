import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parseFutureSupportTicketCreate,
  type SupportTicketCreateContract,
} from "@/features/support/support-contracts";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

type SupabaseUser = { id: string };
type ProfileRow = { role: "admin" | "patient" | "therapist" };
type SupportTicketRow = {
  category: string;
  created_at: string;
  id: string;
  last_activity_at: string;
  status: string;
  subject: string;
};

export async function GET() {
  const context = await getTherapistSupportContext();
  if (!context.ok) return failure(context.message, context.status);

  try {
    const tickets = await supabaseRequest<SupportTicketRow[]>(
      context.config,
      context.accessToken,
      "/rest/v1/support_tickets?select=id,category,subject,status,created_at,last_activity_at&order=last_activity_at.desc",
    );

    return NextResponse.json(
      {
        ok: true,
        tickets: tickets.map((ticket) => ({
          category: ticket.category,
          createdAt: ticket.created_at,
          id: ticket.id,
          lastActivityAt: ticket.last_activity_at,
          protocol: ticket.id.slice(0, 8).toUpperCase(),
          status: ticket.status,
          subject: ticket.subject,
        })),
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível carregar seus chamados agora.", 503);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  const parsed = parseFutureSupportTicketCreate(body);
  if (!parsed) return failure("Revise as informações do chamado.", 422);

  const context = await getTherapistSupportContext();
  if (!context.ok) return failure(context.message, context.status);

  try {
    const ticket = await callCreateTicket(
      context.config,
      context.accessToken,
      parsed,
    );

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          id: ticket.id,
          protocol: ticket.id.slice(0, 8).toUpperCase(),
          status: ticket.status,
        },
      },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch (error) {
    return rpcFailure(error, "Não foi possível abrir o chamado agora.");
  }
}

async function getTherapistSupportContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
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
    if (profiles[0]?.role !== "therapist") {
      return {
        ok: false as const,
        message: "Acesso de terapeuta necessário.",
        status: 403,
      };
    }

    return { accessToken, config, ok: true as const };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
}

async function callCreateTicket(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  input: SupportTicketCreateContract,
) {
  const response = await fetch(
    `${config.url}/rest/v1/rpc/create_support_ticket_v1`,
    {
      body: JSON.stringify({
        p_booking_id: input.bookingId,
        p_category: input.category,
        p_description: input.description,
        p_request_id: input.requestId,
        p_source: input.source,
        p_subject: input.subject,
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
  if (!response.ok) throw await response.json().catch(() => null);
  return (await response.json()) as { id: string; status: string };
}

async function supabaseRequest<T>(
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

function rpcFailure(error: unknown, fallback: string) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;
  if (code === "22023")
    return failure("Revise as informações do chamado.", 422);
  if (code === "42501")
    return failure("Você não pode vincular esta sessão.", 403);
  if (code === "P0001")
    return failure("Aguarde um momento antes de enviar outro chamado.", 429);
  return failure(fallback, 503);
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
