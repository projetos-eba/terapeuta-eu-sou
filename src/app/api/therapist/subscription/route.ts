import { NextResponse } from "next/server";

import { getTherapistPlanPageData } from "@/features/therapist-plan";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

type Command = {
  action?: "cancel" | "change_plan" | "resume";
  targetPlan?: "premium" | "premium_plus";
};

export async function GET() {
  try {
    const session = await requireTherapistSession();
    const overview = await getTherapistPlanPageData({
      accessToken: session.accessToken,
      effectivePlan: session.plan,
      profileId: session.profileId,
    });
    return NextResponse.json({ ok: true, overview });
  } catch {
    return failure("Não foi possível consultar sua assinatura agora.", 503);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const session = await requireTherapistSession();
    const body = (await request.json().catch(() => null)) as Command | null;
    const config = getSupabasePublicConfig();
    if (!body?.action || !config) {
      return failure("Não foi possível concluir esta solicitação.", 422);
    }
    if (body.action === "change_plan" && !body.targetPlan) {
      return failure("Escolha um plano válido para continuar.", 422);
    }

    const functionName =
      body.action === "change_plan"
        ? "stripe-change-therapist-subscription"
        : "stripe-cancel-therapist-subscription";
    const payload = await invokeSupabaseFunction<{ data: unknown; ok: true }>(
      config,
      functionName,
      {
        accessToken: session.accessToken,
        body:
          body.action === "change_plan"
            ? { targetPlan: body.targetPlan }
            : { action: body.action },
      },
    );

    return NextResponse.json({ data: payload.data, ok: true });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      return failure(
        safeCommandMessage(error.code),
        error.status >= 400 ? error.status : 502,
      );
    }

    console.error(
      JSON.stringify({
        code: "THERAPIST_SUBSCRIPTION_COMMAND_ERROR",
        operation: "therapist_subscription_command",
        requestId,
      }),
    );
    return failure("Não foi possível atualizar sua assinatura agora.", 500);
  }
}

function safeCommandMessage(code?: string) {
  if (code === "same_plan") return "Este já é o seu plano atual.";
  if (code === "active_subscription_not_found") {
    return "Não encontramos uma assinatura ativa para alterar.";
  }
  if (code === "stripe_price_missing") {
    return "Este plano está temporariamente indisponível.";
  }
  return "Não foi possível atualizar sua assinatura agora.";
}

function failure(message: string, status: number) {
  return NextResponse.json({ message, ok: false }, { status });
}
