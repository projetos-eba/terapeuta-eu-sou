import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string; professionalId: string }> },
) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return NextResponse.json(
      {
        error: {
          message: "Entre com uma conta administrativa para continuar.",
        },
        ok: false,
      },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  const { documentId, professionalId } = await context.params;
  const url = new URL(request.url);
  const disposition =
    url.searchParams.get("download") === "1" ? "attachment" : "inline";

  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify({
        action: "admin.sign",
        disposition,
        documentId,
        therapistProfileId: professionalId,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string; professionalId: string }> },
) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return NextResponse.json(
      {
        error: {
          message: "Entre com uma conta administrativa para continuar.",
        },
        ok: false,
      },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
    reason?: unknown;
  } | null;
  const decision = body?.decision;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  if (
    (decision !== "accepted" && decision !== "resubmission_requested") ||
    (decision === "resubmission_requested" && (!reason || reason.length < 3))
  ) {
    return NextResponse.json(
      {
        error: { message: "Informe o motivo do reenvio do documento." },
        ok: false,
      },
      { headers: { "Cache-Control": "no-store" }, status: 422 },
    );
  }

  const { documentId, professionalId } = await context.params;
  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify({
        action: "admin.review",
        decision,
        documentId,
        reason,
        therapistProfileId: professionalId,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const payload = await response.json().catch(() => null);

  if (response.ok && isSuccessPayload(payload)) {
    revalidatePath(routes.admin.professionals);
    revalidatePath(routes.admin.professionalDetail(professionalId));
    revalidatePath(routes.admin.verifications);
  }

  return NextResponse.json(payload ?? { ok: false }, {
    headers: { "Cache-Control": "no-store" },
    status: response.status,
  });
}

function isSuccessPayload(payload: unknown): payload is { ok: true } {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      payload.ok === true,
  );
}

function isFailurePayload(
  payload:
    | { data?: { signedPath?: string }; ok?: boolean }
    | { error?: { message?: string }; ok?: false }
    | null,
): payload is { error?: { message?: string }; ok?: false } {
  return Boolean(payload && payload.ok === false && "error" in payload);
}
