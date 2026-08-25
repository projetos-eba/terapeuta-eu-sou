import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RequesterRole = "patient" | "therapist";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketId: string; attachmentId: string }> },
) {
  const { ticketId, attachmentId } = await params;
  if (!UUID.test(ticketId) || !UUID.test(attachmentId)) {
    return failure("Anexo inválido.", 422);
  }

  const role = readRole(new URL(request.url).searchParams.get("role"));
  const cookieStore = await cookies();
  const resolvedRole = role ?? getSoleSessionRole(cookieStore);
  const accessToken = resolvedRole
    ? cookieStore.get(`tes_${resolvedRole}_access_token`)?.value
    : null;
  const config = getSupabasePublicConfig();
  if (!resolvedRole || !accessToken || !config) {
    return failure("Entre na sua conta.", 401);
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
      status: 200,
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

function readRole(value: string | null): RequesterRole | null {
  return value === "patient" || value === "therapist" ? value : null;
}

function getSoleSessionRole(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const roles = (["patient", "therapist"] as const).filter((role) =>
    Boolean(cookieStore.get(`tes_${role}_access_token`)?.value),
  );
  return roles.length === 1 ? roles[0] : null;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
