import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return NextResponse.json(
      { error: { message: "Entre na sua conta para continuar." }, ok: false },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  const { documentId } = await context.params;
  const url = new URL(request.url);
  const disposition =
    url.searchParams.get("download") === "1" ? "attachment" : "inline";

  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify({
        action: "therapist.sign",
        disposition,
        documentId,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { data?: { signedPath?: string }; ok?: boolean }
    | { error?: { message?: string }; ok?: false }
    | null;
  const signedPath =
    payload && payload.ok === true ? payload.data?.signedPath : undefined;
  const errorMessage = isFailurePayload(payload)
    ? (payload.error?.message ?? "Não foi possível abrir o documento agora.")
    : "Não foi possível abrir o documento agora.";

  if (!response.ok || !payload?.ok || !signedPath) {
    return NextResponse.json(
      {
        error: { message: errorMessage },
        ok: false,
      },
      { headers: { "Cache-Control": "no-store" }, status: response.status },
    );
  }

  return proxySignedDocument(new URL(signedPath, config.url).toString());
}

async function proxySignedDocument(signedUrl: string) {
  const upstream = await fetch(signedUrl, { cache: "no-store" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: { message: "Não foi possível abrir o documento agora." },
        ok: false,
      },
      { headers: { "Cache-Control": "no-store" }, status: 502 },
    );
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  const contentLength = upstream.headers.get("content-length");

  if (contentType) headers.set("Content-Type", contentType);
  if (contentDisposition)
    headers.set("Content-Disposition", contentDisposition);
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers, status: 200 });
}

function isFailurePayload(
  payload:
    | { data?: { signedPath?: string }; ok?: boolean }
    | { error?: { message?: string }; ok?: false }
    | null,
): payload is { error?: { message?: string }; ok?: false } {
  return Boolean(payload && payload.ok === false && "error" in payload);
}
