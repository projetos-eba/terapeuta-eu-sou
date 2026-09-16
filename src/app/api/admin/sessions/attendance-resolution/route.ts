import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESOLUTIONS = new Set([
  "performed",
  "reschedule",
  "refund",
  "retain",
  "platform_reschedule",
  "platform_refund",
]);
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: {
    incidentId?: string;
    reason?: string;
    requestId?: string;
    resolution?: string;
  };

  try {
    body = await request.json();
  } catch {
    return failure("Revise os dados enviados.", 400);
  }

  const reason = body.reason?.trim() ?? "";
  if (
    !UUID_PATTERN.test(body.incidentId ?? "") ||
    !UUID_PATTERN.test(body.requestId ?? "") ||
    !RESOLUTIONS.has(body.resolution ?? "") ||
    reason.length < 20 ||
    reason.length > 1000
  ) {
    return failure(
      "Escolha o desfecho e informe uma justificativa com pelo menos 20 caracteres.",
      422,
    );
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre na conta administrativa para continuar.", 401);
  }

  const session = await readAdminSessionFromAccessToken(
    config,
    accessToken,
  ).catch(() => null);
  if (
    !session ||
    !canUseAdminPermission(session.permissions, "admin.sessions.manage")
  ) {
    return failure("Você não tem permissão para esta ação.", 403);
  }

  try {
    const decisionResponse = await fetch(
      `${config.url}/rest/v1/rpc/admin_resolve_session_attendance_v1`,
      {
        body: JSON.stringify({
          p_incident_id: body.incidentId,
          p_reason: reason,
          p_request_id: body.requestId,
          p_resolution: body.resolution,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const decision = (await decisionResponse.json().catch(() => null)) as {
      bookingId?: string;
      paymentFlowVersion?: string;
      paymentId?: string;
      requiresProviderRefund?: boolean;
    } | null;

    if (!decisionResponse.ok || !decision) {
      return failure(mapDecisionFailure(decision), decisionResponse.status);
    }

    let providerStatus = "not_required";
    if (
      decision.requiresProviderRefund &&
      decision.paymentFlowVersion === "v10" &&
      decision.paymentId
    ) {
      const refundResponse = await fetch(
        `${config.url}/functions/v1/admin-full-session-refund-v10`,
        {
          body: JSON.stringify({
            paymentId: decision.paymentId,
            reason,
            requestId: body.requestId,
          }),
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      providerStatus = refundResponse.ok ? "requested" : "needs_review";
    } else if (decision.requiresProviderRefund) {
      providerStatus = "needs_review";
    }

    revalidatePath(routes.admin.sessions);
    if (decision.bookingId) {
      revalidatePath(routes.admin.sessionDetail(decision.bookingId));
    }

    return NextResponse.json(
      { data: decision, ok: true, providerStatus },
      { headers: NO_STORE },
    );
  } catch {
    return failure("Não foi possível registrar a decisão agora.", 503);
  }
}

function mapDecisionFailure(value: unknown) {
  const message =
    value && typeof value === "object" && "message" in value
      ? String(value.message)
      : "";

  if (message.includes("RETENTION_NOT_AUTHORIZED")) {
    return "A retenção não é permitida pela política desta reserva.";
  }
  if (message.includes("ALREADY_RESOLVED")) {
    return "Este caso já recebeu uma decisão administrativa.";
  }
  return "Não foi possível registrar a decisão. Revise o estado atual antes de tentar novamente.";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { message, ok: false },
    { headers: NO_STORE, status },
  );
}
