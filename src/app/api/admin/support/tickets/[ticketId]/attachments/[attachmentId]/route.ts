import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketId: string; attachmentId: string }> },
) {
  const { ticketId, attachmentId } = await params;
  if (!UUID.test(ticketId) || !UUID.test(attachmentId)) {
    return failure("Anexo inválido.", 422);
  }
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
    !canUseAdminPermission(session.permissions, "admin.support.read")
  ) {
    return failure("Acesso administrativo necessário.", 403);
  }

  try {
    const attachments = await requestSupabase<AttachmentRow[]>(
      config,
      accessToken,
      `/rest/v1/support_ticket_message_attachments?select=storage_object_path,original_name,mime_type&ticket_id=eq.${ticketId}&id=eq.${attachmentId}&limit=1`,
    );
    const attachment = attachments[0];
    if (!attachment) return failure("Anexo não encontrado.", 404);
    const response = await fetch(
      `${config.url}/storage/v1/object/support-ticket-attachments/${encodeStoragePath(attachment.storage_object_path)}`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!response.ok) return failure("Não foi possível abrir o anexo.", 404);
    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(attachment.original_name),
        "Content-Type": attachment.mime_type,
      },
    });
  } catch {
    return failure("Não foi possível abrir o anexo agora.", 503);
  }
}

type AttachmentRow = {
  mime_type: string;
  original_name: string;
  storage_object_path: string;
};

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: { apikey: config.apiKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Support attachment lookup failed");
  return (await response.json()) as T;
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function contentDisposition(fileName: string) {
  const safe = fileName.replace(/[\r\n"]/g, "_");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
