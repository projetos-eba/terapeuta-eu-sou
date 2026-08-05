import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const bucket = "admin-public-media";
const maxImageBytes = 5 * 1024 * 1024;
const noStoreHeaders = { "Cache-Control": "no-store" };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type SupabaseUser = {
  id?: unknown;
};

type ProfileRow = {
  role?: unknown;
};

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

  if (context !== "matching-theme" || !isUploadedFile(file)) {
    return failure("Envie uma imagem válida para o tema.", 400);
  }

  const validation = validateImage(file);
  if (validation) return failure(validation, 422);

  const userId = await readAdminUserId(config, accessToken);
  if (!userId) {
    return failure("Acesso administrativo necessário.", 403);
  }

  const extension = extensionFor(file.type);
  const objectPath = `matching/themes/${userId}-${crypto.randomUUID()}${extension}`;
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

function validateImage(file: File) {
  if (!imageTypes.has(file.type)) {
    return "Use uma imagem JPG, PNG ou WebP.";
  }

  if (file.size > maxImageBytes) {
    return "A imagem deve ter no máximo 5 MB.";
  }

  return null;
}

async function readAdminUserId(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) return null;
  const user = (await userResponse
    .json()
    .catch(() => null)) as SupabaseUser | null;
  const userId = typeof user?.id === "string" ? user.id : null;
  if (!userId) return null;

  const profileResponse = await fetch(
    `${config.url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json().catch(() => null)) as
    | ProfileRow[]
    | null;

  return profiles?.[0]?.role === "admin" ? userId : null;
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

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
