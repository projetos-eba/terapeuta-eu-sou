import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ professionalId: string }> },
) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }

  const { professionalId } = await context.params;
  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify({
        action: "admin.read",
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
