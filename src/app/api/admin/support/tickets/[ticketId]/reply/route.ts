import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizePlainText } from "@/features/support/support-contracts";
import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import {
  readSupportAttachmentFiles,
  removeSupportAttachments,
  uploadSupportAttachments,
} from "@/features/support/support-attachments";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return failure("Chamado inválido.", 422);
  const isMultipart = request.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("multipart/form-data");
  let input: unknown;
  let attachments: ReturnType<typeof readSupportAttachmentFiles>["files"] = [];
  if (isMultipart) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return failure("Envie os dados em formato válido.", 400);
    const parsedFiles = readSupportAttachmentFiles(formData);
    if (parsedFiles.error) return failure(parsedFiles.error, 422);
    attachments = parsedFiles.files;
    input = {
      body: formValue(formData, "body"),
      requestId: formValue(formData, "requestId"),
    };
  } else {
    try {
      input = await request.json();
    } catch {
      return failure("Envie os dados em formato válido.", 400);
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return failure("Revise a resposta.", 422);
  const normalizedBody = normalizePlainText(Reflect.get(input, "body"), true);
  const body =
    normalizedBody ||
    (attachments.length > 0
      ? "Envio um anexo para ajudar no atendimento."
      : null);
  const requestId = Reflect.get(input, "requestId");
  if (
    !body ||
    body.length > 4000 ||
    typeof requestId !== "string" ||
    !UUID.test(requestId)
  )
    return failure("Revise a resposta.", 422);

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken)
    return failure("Entre com uma conta administrativa para continuar.", 401);
  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (
    !session ||
    !canUseAdminPermission(session.permissions, "admin.support.manage")
  )
    return failure("Acesso administrativo necessário.", 403);

  let uploadedPaths: string[] = [];
  try {
    if (attachments.length > 0) {
      const existingMessage = await findExistingAdminMessage(
        config,
        accessToken,
        ticketId,
        session.userId,
        requestId,
      );
      if (existingMessage) {
        return NextResponse.json(
          { ok: true },
          { headers: { "Cache-Control": "no-store" }, status: 201 },
        );
      }
    }

    const uploaded = attachments.length
      ? await uploadSupportAttachments({
          accessToken,
          config,
          files: attachments,
          requestId,
          ticketId,
        })
      : { descriptors: [], uploadedPaths: [] };
    uploadedPaths = uploaded.uploadedPaths;
    const response = await fetch(
      `${config.url}/rest/v1/rpc/${attachments.length ? "admin_reply_support_ticket_with_attachments_v1" : "admin_reply_support_ticket_v1"}`,
      {
        body: JSON.stringify({
          p_body: body,
          ...(attachments.length
            ? { p_attachments: uploaded.descriptors }
            : {}),
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
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      await removeSupportAttachments(config, accessToken, uploadedPaths);
      return failure(
        payload?.code === "P0002"
          ? "Chamado não encontrado."
          : payload?.code === "22023"
            ? "Esta resposta não é permitida no estado atual do chamado."
            : "Não foi possível enviar a resposta agora.",
        payload?.code === "P0002" ? 404 : payload?.code === "22023" ? 422 : 503,
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" }, status: 201 },
    );
  } catch {
    await removeSupportAttachments(config, accessToken, uploadedPaths);
    return failure("Não foi possível enviar a resposta agora.", 503);
  }
}

async function findExistingAdminMessage(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  ticketId: string,
  userId: string,
  requestId: string,
) {
  const response = await fetch(
    `${config.url}/rest/v1/support_ticket_messages?select=id&ticket_id=eq.${ticketId}&author_profile_id=eq.${userId}&request_id=eq.${encodeURIComponent(requestId)}&visibility=eq.requester&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok)
    throw new Error("Support message idempotency lookup failed");
  const messages = (await response.json()) as Array<{ id: string }>;
  return messages[0] ?? null;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
