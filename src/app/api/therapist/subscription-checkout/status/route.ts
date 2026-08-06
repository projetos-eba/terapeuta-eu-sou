import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  TherapistPlan,
  type TherapistPlan as TherapistPlanValue,
} from "@/domain/tes";
import { setTherapistPlanCookie } from "@/features/therapist-auth/session-cookies";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const therapistCookieName = "tes_therapist_access_token";

type StatusBody = {
  sessionId?: string;
};

type StatusResponse = {
  checkoutSessionId: string;
  plan: "free" | "premium" | "premium_plus" | null;
  status:
    | "active"
    | "canceled"
    | "expired"
    | "failed"
    | "pending"
    | "requires_action";
  subscriptionStatus: string | null;
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const sessionId = await parseSessionId(request);
    const accessToken = (await cookies()).get(therapistCookieName)?.value;

    if (!accessToken) {
      return jsonError(
        "unauthorized",
        "Entre na sua conta para confirmar a assinatura.",
        401,
        requestId,
      );
    }

    const supabaseConfig = getSupabasePublicConfig();

    if (!supabaseConfig) {
      return jsonError(
        "supabase_config_unavailable",
        "Nao conseguimos confirmar a assinatura agora.",
        503,
        requestId,
      );
    }

    const payload = await invokeSupabaseFunction<{
      data: StatusResponse;
      ok: true;
    }>(supabaseConfig, "stripe-subscription-checkout-status", {
      accessToken,
      body: { sessionId },
      method: "POST",
    });

    const response = NextResponse.json(
      {
        checkout: payload.data,
        ok: true,
      },
      { status: 200 },
    );

    if (
      payload.data.status === "active" &&
      isConfirmedPaidPlan(payload.data.plan)
    ) {
      setTherapistPlanCookie(response, payload.data.plan);
    }

    return response;
  } catch (error) {
    if (error instanceof Response) return error;

    if (error instanceof SupabaseFunctionError) {
      return jsonError(
        error.code ?? "subscription_status_unavailable",
        error.message || "Nao conseguimos confirmar a assinatura agora.",
        error.status,
        error.requestId ?? requestId,
      );
    }

    console.error(
      JSON.stringify({
        code: "SUBSCRIPTION_CHECKOUT_STATUS_ROUTE_ERROR",
        message: error instanceof Error ? error.message : "UNKNOWN",
        operation: "therapist_subscription_checkout_status_route",
        requestId,
      }),
    );

    return jsonError(
      "internal_error",
      "Nao conseguimos confirmar a assinatura agora.",
      500,
      requestId,
    );
  }
}

function isConfirmedPaidPlan(
  plan: StatusResponse["plan"],
): plan is TherapistPlanValue {
  return plan === TherapistPlan.Premium || plan === TherapistPlan.PremiumPlus;
}

async function parseSessionId(request: Request) {
  const body = (await request.json().catch(() => null)) as StatusBody | null;
  const sessionId = body?.sessionId;

  if (
    typeof sessionId !== "string" ||
    !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)
  ) {
    throw jsonError(
      "invalid_checkout_session_id",
      "Sessao de checkout invalida.",
      422,
      crypto.randomUUID(),
    );
  }

  return sessionId;
}

function jsonError(
  code: string,
  message: string,
  status: number,
  requestId: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
      },
      ok: false,
    },
    { status },
  );
}
