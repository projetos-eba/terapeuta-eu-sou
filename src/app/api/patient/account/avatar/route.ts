import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { hasValidUploadSignature, isSupportedImageType } from "@/lib/media/upload-validation";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const maxImageBytes = 5 * 1024 * 1024;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_patient_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Envie uma imagem válida.", 400);
  }

  const file = formData.get("file");
  if (!isUploadedFile(file) || !isSupportedImageType(file.type)) {
    return failure("Escolha uma imagem em JPG, PNG ou WebP.", 422);
  }
  if (file.size > maxImageBytes || !(await hasValidUploadSignature(file))) {
    return failure("A imagem deve ter no máximo 5 MB e corresponder ao formato informado.", 422);
  }

  formData.set("action", "upload_avatar");
  try {
    const response = await fetch(`${config.url}/functions/v1/patient-account-command`, {
      body: formData,
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    });
    const text = await response.text();
    return new NextResponse(text, {
      headers: { ...noStoreHeaders, "Content-Type": "application/json" },
      status: response.status,
    });
  } catch {
    return failure("Não foi possível enviar sua foto agora.", 503);
  }
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).type === "string"
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}
