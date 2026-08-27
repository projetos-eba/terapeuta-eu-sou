import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizePlainText } from "@/features/support/support-contracts";
import {
  readSupportAttachmentFiles,
  removeSupportAttachments,
  uploadSupportAttachments,
} from "@/features/support/support-attachments";
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
  protocol: string;
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
type AttachmentRow = {
  id: string;
  message_id: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  original_name: string;
  size_bytes: number;
};
type TicketMessageResponse = Omit<MessageRow, "author_role"> & {
  author_role: "admin" | "patient" | "requester" | "therapist";
  attachments?: ReturnType<typeof toAttachment>[];
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
      `/rest/v1/support_tickets?select=id,protocol,booking_id,category,subject,description,status,created_at,last_activity_at,resolved_at&id=eq.${ticketId}&limit=1`,
    );
    const ticket = tickets[0];
    if (!ticket) return failure("Chamado não encontrado.", 404);

    const persistedMessages = await requestSupabase<MessageRow[]>(
      context.config,
      context.accessToken,
      `/rest/v1/support_ticket_messages?select=id,author_role,body,created_at&ticket_id=eq.${ticketId}&visibility=eq.requester&order=created_at.asc`,
    );
    const messageIds = persistedMessages.map((message) => message.id);
    const attachments = messageIds.length
      ? await requestSupabase<AttachmentRow[]>(
          context.config,
          context.accessToken,
          `/rest/v1/support_ticket_message_attachments?select=id,message_id,original_name,mime_type,size_bytes&ticket_id=eq.${ticketId}&message_id=in.(${messageIds.join(",")})&order=created_at.asc`,
        ).catch(() => [])
      : [];
    const attachmentsByMessage = new Map<string, AttachmentRow[]>();
    for (const attachment of attachments) {
      const rows = attachmentsByMessage.get(attachment.message_id) ?? [];
      rows.push(attachment);
      attachmentsByMessage.set(attachment.message_id, rows);
    }

    const messages: TicketMessageResponse[] = persistedMessages.length
      ? persistedMessages.map((message) => ({
          ...message,
          attachments: (attachmentsByMessage.get(message.id) ?? []).map(
            (attachment) => toAttachment(ticketId, attachment, context.role),
          ),
        }))
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
          protocol: ticket.protocol,
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

  const isMultipart = request.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("multipart/form-data");
  let payload: unknown;
  let attachments: ReturnType<typeof readSupportAttachmentFiles>["files"] = [];
  if (isMultipart) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return failure("Envie os dados em formato válido.", 400);
    const parsedFiles = readSupportAttachmentFiles(formData);
    if (parsedFiles.error) return failure(parsedFiles.error, 422);
    attachments = parsedFiles.files;
    payload = {
      actorRole: formValue(formData, "actorRole"),
      body: formValue(formData, "body"),
      requestId: formValue(formData, "requestId"),
    };
  } else {
    try {
      payload = await request.json();
    } catch {
      return failure("Envie os dados em formato válido.", 400);
    }
  }
  const parsed = parseMessage(payload, attachments.length > 0);
  if (!parsed.ok) return failure(parsed.message, 422);

  const context = await getContext(parsed.actorRole);
  if (!context.ok) return failure(context.message, context.status);

  let uploadedPaths: string[] = [];
  try {
    if (attachments.length > 0) {
      const existingMessage = await findExistingRequesterMessage(
        context.config,
        context.accessToken,
        ticketId,
        context.userId,
        parsed.requestId,
      );
      if (existingMessage) {
        return NextResponse.json(
          { ok: true },
          { headers: noStoreHeaders, status: 201 },
        );
      }
    }

    const uploaded =
      attachments.length > 0
        ? await uploadSupportAttachments({
            accessToken: context.accessToken,
            config: context.config,
            files: attachments,
            requestId: parsed.requestId,
            ticketId,
          })
        : { descriptors: [], uploadedPaths: [] };
    uploadedPaths = uploaded.uploadedPaths;
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/${attachments.length > 0 ? "send_support_ticket_requester_message_with_attachments_v1" : "send_support_ticket_requester_message_v1"}`,
      {
        body: JSON.stringify({
          p_body: parsed.body,
          ...(attachments.length > 0
            ? { p_attachments: uploaded.descriptors }
            : {}),
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
    if (!response.ok) {
      await removeSupportAttachments(
        context.config,
        context.accessToken,
        uploadedPaths,
      );
      return rpcFailure(await response.json().catch(() => null));
    }

    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch {
    await removeSupportAttachments(
      context.config,
      context.accessToken,
      uploadedPaths,
    );
    return failure("Não foi possível enviar sua resposta agora.", 503);
  }
}

function parseMessage(value: unknown, hasAttachments = false) {
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
  if ((!normalized && !hasAttachments) || (normalized?.length ?? 0) > 4000) {
    return { ok: false as const, message: "Revise sua resposta." };
  }
  return {
    actorRole,
    body: normalized ?? "Envio um anexo para ajudar no atendimento.",
    ok: true as const,
    requestId,
  };
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toAttachment(
  ticketId: string,
  attachment: AttachmentRow,
  actorRole: RequesterRole,
) {
  return {
    downloadPath: `/api/support/tickets/${ticketId}/attachments/${attachment.id}?role=${actorRole}`,
    fileName: attachment.original_name,
    id: attachment.id,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes,
  };
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
    return {
      accessToken,
      config,
      ok: true as const,
      role: resolvedRole,
      userId: user.id,
    };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
}

async function findExistingRequesterMessage(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  ticketId: string,
  userId: string,
  requestId: string,
) {
  const messages = await requestSupabase<Array<{ id: string }>>(
    config,
    accessToken,
    `/rest/v1/support_ticket_messages?select=id&ticket_id=eq.${ticketId}&author_profile_id=eq.${userId}&request_id=eq.${encodeURIComponent(requestId)}&visibility=eq.requester&limit=1`,
  );
  return messages[0] ?? null;
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
