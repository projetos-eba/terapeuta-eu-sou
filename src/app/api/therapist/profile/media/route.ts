import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mapTherapistProfileEditorContract } from "@/features/therapist-profile-editor/therapist-profile-editor.mappers";
import {
  hasValidUploadSignature,
  isSupportedImageType,
  isSupportedVideoType,
} from "@/lib/media/upload-validation";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const bucket = "therapist-public-media";
const maxImageBytes = 5 * 1024 * 1024;
const maxVideoBytes = 5 * 1024 * 1024;
const noStoreHeaders = { "Cache-Control": "no-store" };

type MediaKind = "photo" | "video" | "video_thumbnail";

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Envie um arquivo válido.", 400);
  }

  const kind = formData.get("kind");
  const file = formData.get("file");

  if (!isMediaKind(kind) || !isUploadedFile(file)) {
    return failure("Envie um arquivo válido.", 400);
  }

  const validation = await validateFile(file, kind);
  if (validation) return failure(validation, 422);

  const userId = await readAuthenticatedUserId(config, accessToken);
  if (!userId) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  const editor = await readEditor(config, accessToken);
  if (!editor) {
    return failure("Não foi possível validar seu perfil agora.", 503);
  }

  if (kind === "video" && !editor.capabilities.canUploadVideo) {
    return failure("Seu plano atual não permite vídeo de apresentação.", 403);
  }

  if (kind === "video_thumbnail" && !editor.capabilities.canUseFeaturedMedia) {
    return failure("Seu plano atual não permite mídia em destaque.", 403);
  }

  const extension = extensionFor(file.type);
  const objectPath = `${userId}/profile/${kind}-${crypto.randomUUID()}${extension}`;
  const uploadResponse = await fetch(
    `${config.url}/storage/v1/object/${bucket}/${objectPath}`,
    {
      body: file,
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Cache-Control": "31536000",
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      method: "POST",
    },
  );

  if (!uploadResponse.ok) {
    return failure("Não foi possível enviar o arquivo agora.", 502);
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${bucket}/${objectPath}`;

  return NextResponse.json(
    {
      data: {
        contentType: file.type,
        kind,
        publicUrl,
        size: file.size,
      },
      ok: true,
    },
    { headers: noStoreHeaders },
  );
}

async function readAuthenticatedUserId(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
  } | null;

  return typeof payload?.id === "string" ? payload.id : null;
}

async function readEditor(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  const response = await fetch(
    `${config.url}/functions/v1/therapist-profile-command`,
    {
      body: JSON.stringify({ action: "read" }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    data?: unknown;
    ok?: boolean;
  } | null;

  if (!payload?.ok) return null;

  try {
    return mapTherapistProfileEditorContract(payload.data);
  } catch {
    return null;
  }
}

function extensionFor(contentType: string) {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "video/webm") return ".webm";
  if (contentType === "video/quicktime") return ".mov";
  return ".mp4";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}

function isMediaKind(value: unknown): value is MediaKind {
  return value === "photo" || value === "video" || value === "video_thumbnail";
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).type === "string"
  );
}

async function validateFile(file: File, kind: MediaKind) {
  if (kind === "video") {
    if (!isSupportedVideoType(file.type)) {
      return "Envie um vídeo em MP4, WebM ou MOV.";
    }
    if (file.size > maxVideoBytes) {
      return "O vídeo deve ter no máximo 5 MB. Para arquivos maiores, use um link do YouTube ou Vimeo.";
    }
    if (!(await hasValidUploadSignature(file))) {
      return "O conteúdo do arquivo não corresponde ao formato informado.";
    }
    return null;
  }

  if (!isSupportedImageType(file.type)) {
    return "Envie uma imagem em JPG, PNG ou WebP.";
  }
  if (file.size > maxImageBytes) {
    return "A imagem deve ter no máximo 5 MB.";
  }
  if (!(await hasValidUploadSignature(file))) {
    return "O conteúdo do arquivo não corresponde ao formato informado.";
  }
  return null;
}
