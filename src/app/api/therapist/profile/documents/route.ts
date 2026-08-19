import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  hasValidUploadSignature,
  isSupportedDocumentType,
} from "@/lib/media/upload-validation";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const maxDocumentBytes = 10 * 1024 * 1024;

export async function GET() {
  return forwardJsonRequest({ action: "therapist.read" });
}

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return failure("Envie um arquivo válido.", 400);
  }

  const upstream = new FormData();
  upstream.set("action", "therapist.upload");

  const kind = formData.get("kind");
  const file = formData.get("file");

  if (typeof kind === "string") {
    upstream.set("kind", kind);
  }
  if (file instanceof File) {
    upstream.set("file", file);
  }

  if (!isDocumentKind(kind) || !isUploadedFile(file)) {
    return failure("Envie um arquivo válido.", 400);
  }

  const validation = await validateFile(file);
  if (validation) {
    return failure(validation, 422);
  }

  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: upstream,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    },
  );

  return proxyJson(response);
}

async function forwardJsonRequest(body: Record<string, unknown>) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  return proxyJson(response);
}

async function proxyJson(response: Response) {
  const payload = await response.json().catch(() => null);

  return NextResponse.json(payload ?? { ok: false }, {
    headers: noStoreHeaders,
    status: response.status,
  });
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}

async function validateFile(file: File) {
  if (!isSupportedDocumentType(file.type)) {
    return "Envie um arquivo em PDF, JPG ou PNG.";
  }
  if (file.size < 1 || file.size > maxDocumentBytes) {
    return "O documento deve ter no máximo 10 MB.";
  }
  if (!(await hasValidUploadSignature(file))) {
    return "O conteúdo do arquivo não corresponde ao formato informado.";
  }

  return null;
}

function isDocumentKind(
  value: unknown,
): value is "address_proof" | "identity_document" {
  return value === "address_proof" || value === "identity_document";
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
