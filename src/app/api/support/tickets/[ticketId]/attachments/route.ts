import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parseSupportTicketAttachmentDescriptors,
  parseSupportTicketAttachmentInputs,
  type SupportTicketAttachmentDescriptor,
} from "@/features/support/support-contracts";
import { removeSupportAttachments } from "@/features/support/support-attachments";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bucket = "support-ticket-attachments";
const noStoreHeaders = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ ticketId: string }> };
type RequesterRole = "patient" | "therapist";
type SupabaseUser = { id: string };
type ProfileRow = { role: "admin" | "patient" | "therapist" };

type UploadAction = "cleanup" | "complete" | "prepare";

export async function POST(request: Request, { params }: Params) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failure("Envie os dados em formato válido.", 400);
  }

  const action = readAction(Reflect.get(payload, "action"));
  const role = readRole(Reflect.get(payload, "actorRole"));
  const requestId = Reflect.get(payload, "requestId");
  if (
    !action ||
    !role ||
    typeof requestId !== "string" ||
    !UUID.test(requestId)
  ) {
    return failure("Requisição inválida.", 422);
  }

  const context = await getContext(role);
  if (!context.ok) return failure(context.message, context.status);
  let hasTicket: boolean;
  try {
    hasTicket = await requesterOwnsTicket(
      context.config,
      context.accessToken,
      ticketId,
    );
  } catch {
    return failure("Não foi possível preparar os anexos agora.", 503);
  }
  if (!hasTicket) return failure("Chamado não encontrado.", 404);

  if (action === "prepare") {
    const attachments = parseSupportTicketAttachmentInputs(
      Reflect.get(payload, "attachments"),
    );
    if (!attachments) return failure(attachmentContractMessage, 422);

    try {
      const uploads = await Promise.all(
        attachments.map(async (attachment, index) => {
          const storageObjectPath = [
            ticketId,
            requestId,
            `${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}-${attachment.originalName}`,
          ].join("/");
          const signedUrl = await createSignedUploadUrl(
            context.config,
            context.accessToken,
            storageObjectPath,
          );
          return { ...attachment, signedUrl, storageObjectPath };
        }),
      );
      return NextResponse.json(
        { ok: true, uploads },
        { headers: noStoreHeaders },
      );
    } catch {
      return failure("Não foi possível preparar os anexos agora.", 503);
    }
  }

  const attachments = parseSupportTicketAttachmentDescriptors(
    Reflect.get(payload, "attachments"),
  );
  if (
    !attachments ||
    !allPathsBelongToRequest(attachments, ticketId, requestId)
  ) {
    return failure(attachmentContractMessage, 422);
  }

  if (action === "cleanup") {
    await removeSupportAttachments(
      context.config,
      context.accessToken,
      attachments.map((attachment) => attachment.storageObjectPath),
    );
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  }

  try {
    const response = await fetch(
      `${context.config.url}/rest/v1/rpc/attach_support_ticket_requester_attachments_v1`,
      {
        body: JSON.stringify({
          p_attachments: attachments,
          p_request_id: requestId,
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
        attachments.map((attachment) => attachment.storageObjectPath),
      );
      return failure(attachmentContractMessage, 422);
    }
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    await removeSupportAttachments(
      context.config,
      context.accessToken,
      attachments.map((attachment) => attachment.storageObjectPath),
    );
    return failure("Não foi possível concluir o envio dos anexos agora.", 503);
  }
}

const attachmentContractMessage =
  "Não foi possível enviar o anexo. Use até 5 arquivos de até 10 MB cada, nos formatos PDF, JPG, PNG ou WebP.";

function readAction(value: unknown): UploadAction | null {
  return value === "prepare" || value === "complete" || value === "cleanup"
    ? value
    : null;
}

function readRole(value: unknown): RequesterRole | null {
  return value === "patient" || value === "therapist" ? value : null;
}

function allPathsBelongToRequest(
  attachments: SupportTicketAttachmentDescriptor[],
  ticketId: string,
  requestId: string,
) {
  const prefix = `${ticketId}/${requestId}/`;
  return attachments.every(
    (attachment) =>
      attachment.storageObjectPath.startsWith(prefix) &&
      !attachment.storageObjectPath.includes(".."),
  );
}

async function createSignedUploadUrl(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  storageObjectPath: string,
) {
  const response = await fetch(
    `${config.url}/storage/v1/object/upload/sign/${bucket}/${encodeStoragePath(storageObjectPath)}`,
    {
      body: "{}",
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-upsert": "false",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    url?: string;
  } | null;
  if (
    !response.ok ||
    !payload?.url ||
    !payload.url.startsWith("/object/upload/sign/")
  ) {
    throw new Error("Support attachment signing failed");
  }
  return `${config.url}/storage/v1${payload.url}`;
}

async function requesterOwnsTicket(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  ticketId: string,
) {
  const response = await fetch(
    `${config.url}/rest/v1/support_tickets?select=id&id=eq.${ticketId}&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) throw new Error("Support ticket access failed");
  const tickets = (await response.json()) as Array<{ id: string }>;
  return Boolean(tickets[0]);
}

async function getContext(role: RequesterRole) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(`tes_${role}_access_token`)?.value;
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
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
    if (profiles[0]?.role !== role) {
      return {
        ok: false as const,
        message: "Acesso de paciente ou terapeuta necessário.",
        status: 403,
      };
    }
    return { accessToken, config, ok: true as const };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
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

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
