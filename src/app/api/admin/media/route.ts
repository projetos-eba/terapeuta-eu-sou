import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  hasValidUploadSignature,
  isSupportedImageType,
} from "@/lib/media/upload-validation";
import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const bucket = "admin-public-media";
const maxImageBytes = 5 * 1024 * 1024;
const noStoreHeaders = { "Cache-Control": "no-store" };

const uploadContexts = {
  "matching-theme": {
    objectPrefix: "matching/themes",
    permission: "admin.matching.manage",
  },
  "therapy-image": {
    objectPrefix: "therapies",
    permission: "admin.therapies.manage",
  },
} as const;

type UploadContext = keyof typeof uploadContexts;

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Envie um arquivo válido.", 400);
  }

  const context = formData.get("context");
  const file = formData.get("file");

  if (!isUploadContext(context) || !isUploadedFile(file)) {
    return failure("Envie uma imagem válida para o contexto informado.", 400);
  }

  const validation = await validateImage(file);
  if (validation) return failure(validation, 422);

  const session = await readAdminApiSession(config, accessToken);
  if (
    !session ||
    !canUseAdminPermission(
      session.permissions,
      uploadContexts[context].permission,
    )
  ) {
    return failure("Acesso administrativo necessário.", 403);
  }

  const extension = extensionFor(file.type);
  const objectPath = `${uploadContexts[context].objectPrefix}/${session.userId}-${crypto.randomUUID()}${extension}`;
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
    return failure("Não foi possível enviar a imagem agora.", 502);
  }

  return NextResponse.json(
    {
      data: {
        contentType: file.type,
        publicUrl: `${config.url}/storage/v1/object/public/${bucket}/${objectPath}`,
        size: file.size,
      },
      ok: true,
    },
    { headers: noStoreHeaders },
  );
}

async function validateImage(file: File) {
  if (!isSupportedImageType(file.type)) {
    return "Use uma imagem JPG, PNG ou WebP.";
  }

  if (file.size > maxImageBytes) {
    return "A imagem deve ter no máximo 5 MB.";
  }

  if (!(await hasValidUploadSignature(file))) {
    return "O conteúdo do arquivo não corresponde ao formato informado.";
  }

  return null;
}

async function readAdminApiSession(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  try {
    return await readAdminSessionFromAccessToken(config, accessToken);
  } catch {
    return null;
  }
}

function extensionFor(contentType: string) {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";
  return ".png";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "type" in value &&
    "size" in value,
  );
}

function isUploadContext(
  value: FormDataEntryValue | null,
): value is UploadContext {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(uploadContexts, value)
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
