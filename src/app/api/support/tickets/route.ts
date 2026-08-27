import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parseFutureSupportTicketCreate,
  type SupportTicketCreateContract,
} from "@/features/support/support-contracts";
import {
  readSupportAttachmentFiles,
  removeSupportAttachments,
  uploadSupportAttachments,
} from "@/features/support/support-attachments";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

type SupabaseUser = { id: string };
type ProfileRow = { role: "admin" | "patient" | "therapist" };
type SupportTicketRow = {
  category: string;
  created_at: string;
  id: string;
  last_activity_at: string;
  protocol: string;
  status: string;
  subject: string;
};
type RequesterRole = "patient" | "therapist";

export async function GET(request: Request) {
  const role = readRole(new URL(request.url).searchParams.get("role"));
  const context = await getRequesterSupportContext(role);
  if (!context.ok) return failure(context.message, context.status);

  try {
    const tickets = await supabaseRequest<SupportTicketRow[]>(
      context.config,
      context.accessToken,
      "/rest/v1/support_tickets?select=id,protocol,category,subject,status,created_at,last_activity_at&order=last_activity_at.desc",
    );

    return NextResponse.json(
      {
        ok: true,
        tickets: tickets.map((ticket) => ({
          category: ticket.category,
          createdAt: ticket.created_at,
          id: ticket.id,
          lastActivityAt: ticket.last_activity_at,
          protocol: ticket.protocol,
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
  const isMultipart = request.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("multipart/form-data");
  let body: unknown;
  let attachments: ReturnType<typeof readSupportAttachmentFiles>["files"] = [];
  if (isMultipart) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return failure("Envie os dados em formato válido.", 400);
    const parsedFiles = readSupportAttachmentFiles(formData);
    if (parsedFiles.error) return failure(parsedFiles.error, 422);
    attachments = parsedFiles.files;
    body = {
      actorRole: formValue(formData, "actorRole"),
      bookingId: formValue(formData, "bookingId") || null,
      category: formValue(formData, "category"),
      description: formValue(formData, "description"),
      requestId: formValue(formData, "requestId"),
      source: formValue(formData, "source"),
      subject: formValue(formData, "subject"),
    };
  } else {
    try {
      body = await request.json();
    } catch {
      return failure("Envie os dados em formato válido.", 400);
    }
  }

  const parsed = parseFutureSupportTicketCreate(stripActorRole(body));
  const role = readRole(
    body && typeof body === "object" && !Array.isArray(body)
      ? Reflect.get(body, "actorRole")
      : null,
  );
  if (!role) return failure("Nao foi possivel identificar sua area.", 422);
  if (!parsed) return failure("Revise as informações do chamado.", 422);

  const context = await getRequesterSupportContext(role);
  if (!context.ok) return failure(context.message, context.status);

  const ticketId = attachments.length > 0 ? crypto.randomUUID() : null;
  let uploadedPaths: string[] = [];
  try {
    if (attachments.length > 0) {
      const existingTicket = await findExistingTicket(
        context.config,
        context.accessToken,
        parsed.requestId,
      );
      if (existingTicket) {
        return NextResponse.json(
          {
            ok: true,
            ticket: {
              id: existingTicket.id,
              protocol: existingTicket.protocol,
              status: existingTicket.status,
            },
          },
          { headers: noStoreHeaders, status: 201 },
        );
      }
    }

    const ticket = await callCreateTicket(
      context.config,
      context.accessToken,
      parsed,
      ticketId,
      [],
    );
    const uploaded = ticketId
      ? await uploadSupportAttachments({
          accessToken: context.accessToken,
          config: context.config,
          files: attachments,
          requestId: parsed.requestId,
          ticketId: ticket.id,
        })
      : { descriptors: [], uploadedPaths: [] };
    uploadedPaths = uploaded.uploadedPaths;
    if (ticketId && uploaded.descriptors.length > 0) {
      await attachTicketAttachments(
        context.config,
        context.accessToken,
        ticket.id,
        parsed.requestId,
        uploaded.descriptors,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          id: ticket.id,
          protocol: ticket.protocol,
          status: ticket.status,
        },
      },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch (error) {
    await removeSupportAttachments(
      context.config,
      context.accessToken,
      uploadedPaths,
    );
    return rpcFailure(error, "Não foi possível abrir o chamado agora.");
  }
}

async function getRequesterSupportContext(role: RequesterRole | null) {
  const cookieStore = await cookies();
  const resolvedRole = role ?? getSoleSessionRole(cookieStore);
  const accessToken = resolvedRole
    ? cookieStore.get(`tes_${resolvedRole}_access_token`)?.value
    : undefined;
  const config = getSupabasePublicConfig();
  if (!resolvedRole || !config || !accessToken) {
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
    if (profiles[0]?.role !== resolvedRole) {
      return {
        ok: false as const,
        message: "Acesso de paciente ou terapeuta necessário.",
        status: 403,
      };
    }

    return { accessToken, config, ok: true as const, userId: user.id };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
}

async function findExistingTicket(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  requestId: string,
) {
  const tickets = await supabaseRequest<
    Array<{ id: string; protocol: string; status: string }>
  >(
    config,
    accessToken,
    `/rest/v1/support_tickets?select=id,protocol,status&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
  );
  return tickets[0] ?? null;
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

function stripActorRole(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const { actorRole: _actorRole, ...ticket } = value as Record<string, unknown>;
  return ticket;
}

async function callCreateTicket(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  input: SupportTicketCreateContract,
  ticketId: string | null,
  attachments: Array<{
    mimeType: string;
    originalName: string;
    sizeBytes: number;
    storageObjectPath: string;
  }>,
) {
  const withAttachments = Boolean(ticketId);
  const response = await fetch(
    `${config.url}/rest/v1/rpc/${withAttachments ? "create_support_ticket_with_attachments_v1" : "create_support_ticket_v1"}`,
    {
      body: JSON.stringify({
        ...(withAttachments
          ? { p_attachments: attachments, p_ticket_id: ticketId }
          : {}),
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
  return (await response.json()) as {
    id: string;
    protocol: string;
    status: string;
  };
}

async function attachTicketAttachments(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  ticketId: string,
  requestId: string,
  attachments: Array<{
    mimeType: string;
    originalName: string;
    sizeBytes: number;
    storageObjectPath: string;
  }>,
) {
  const response = await fetch(
    `${config.url}/rest/v1/rpc/attach_support_ticket_requester_attachments_v1`,
    {
      body: JSON.stringify({
        p_attachments: attachments,
        p_request_id: requestId,
        p_ticket_id: ticketId,
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
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
