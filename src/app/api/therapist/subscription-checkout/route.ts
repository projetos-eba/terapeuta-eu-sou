import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EdgeCheckoutResponse = {
  data?: {
    checkoutSessionId?: string;
    checkoutUiMode?: string;
    clientSecret?: string | null;
    currency?: string;
    discountAmountCents?: number;
    originalAmountCents?: number;
    promotion?: PromotionSummary | null;
    totalAmountCents?: number;
    url?: string | null;
  };
  ok: boolean;
};

type PromotionSummary = {
  amountOffCents?: number;
  code: string;
  couponId: string;
  duration: "forever" | "once" | "repeating";
  durationInMonths?: number;
  percentOff?: number;
  promotionCodeId: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados do checkout em formato válido.", 400);
  }

  const input = parseInput(body);

  if (
    !isPaidPlan(input.plan) ||
    !isCheckoutUiMode(input.checkoutUiMode) ||
    !UUID.test(input.requestId) ||
    (input.replaceCheckoutSessionId !== null &&
      !input.replaceCheckoutSessionId.startsWith("cs_")) ||
    (input.promotionCode !== null && !input.promotionCode.trim())
  ) {
    return failure("Revise o plano escolhido antes de continuar.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre como terapeuta para continuar.", 401);
  }

  try {
    const response = await invokeSupabaseFunction<EdgeCheckoutResponse>(
      config,
      "stripe-create-subscription-checkout",
      {
        accessToken,
        body: {
          checkoutUiMode: input.checkoutUiMode,
          plan: input.plan,
          promotionCode: input.promotionCode,
          replaceCheckoutSessionId: input.replaceCheckoutSessionId,
          requestId: input.requestId,
        },
      },
    );

    const checkout = response.data;

    if (
      !response.ok ||
      !checkout ||
      (input.checkoutUiMode === "embedded" && !checkout.clientSecret) ||
      (input.checkoutUiMode === "hosted" && !checkout.url)
    ) {
      return failure(
        "Não conseguimos carregar o checkout agora.",
        502,
        "CHECKOUT_RESPONSE_MISSING",
      );
    }

    return NextResponse.json(
      {
        checkout: {
          checkoutSessionId: checkout.checkoutSessionId,
          clientSecret: checkout.clientSecret,
          currency: checkout.currency,
          discountAmountCents: checkout.discountAmountCents,
          mode: checkout.checkoutUiMode,
          originalAmountCents: checkout.originalAmountCents,
          promotion: checkout.promotion,
          totalAmountCents: checkout.totalAmountCents,
          url: checkout.url,
        },
        ok: true,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      const mapped = mapCheckoutError(error);

      return failure(mapped.message, mapped.status, mapped.code);
    }

    return failure("Não conseguimos iniciar o pagamento agora.", 500);
  }
}

function parseInput(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    checkoutUiMode:
      typeof record.checkoutUiMode === "string"
        ? record.checkoutUiMode
        : "embedded",
    plan: typeof record.plan === "string" ? record.plan : "",
    promotionCode:
      record.promotionCode === null
        ? null
        : typeof record.promotionCode === "string"
          ? record.promotionCode
          : null,
    replaceCheckoutSessionId:
      typeof record.replaceCheckoutSessionId === "string"
        ? record.replaceCheckoutSessionId
        : null,
    requestId: typeof record.requestId === "string" ? record.requestId : "",
  };
}

function isPaidPlan(value: string): value is "premium" | "premium_plus" {
  return value === "premium" || value === "premium_plus";
}

function isCheckoutUiMode(value: string): value is "embedded" | "hosted" {
  return value === "embedded" || value === "hosted";
}

function mapCheckoutError(error: SupabaseFunctionError) {
  if (
    error.code === "stripe_price_missing" ||
    error.code === "billing_price_not_found" ||
    error.code === "stripe_catalog_mismatch"
  ) {
    return {
      code: "CATALOG_UNAVAILABLE",
      message: "O catálogo Stripe ainda não está disponível para este plano.",
      status: 409,
    };
  }

  if (
    error.code?.startsWith("promotion_") ||
    error.code === "checkout_replacement_forbidden" ||
    error.code === "checkout_replacement_conflict"
  ) {
    return {
      code: error.code,
      message: error.message || "Código promocional inválido ou indisponível.",
      status: error.status >= 400 ? error.status : 422,
    };
  }

  if (
    error.code === "missing_stripe_env" ||
    error.code === "missing_supabase_env" ||
    error.code === "invalid_stripe_secret_key"
  ) {
    return {
      code: "CONFIGURATION_UNAVAILABLE",
      message:
        "O pagamento está temporariamente indisponível. Tente novamente.",
      status: 503,
    };
  }

  if (error.status === 401 || error.status === 403) {
    return {
      code: "UNAUTHORIZED",
      message: "Entre novamente como terapeuta para continuar.",
      status: error.status,
    };
  }

  return {
    code: "CHECKOUT_UNAVAILABLE",
    message: "Não conseguimos iniciar o pagamento agora.",
    status: error.status >= 400 ? error.status : 502,
  };
}

function failure(message: string, status: number, code = "CHECKOUT_ERROR") {
  return NextResponse.json(
    {
      code,
      message,
      ok: false,
    },
    { headers: noStoreHeaders, status },
  );
}
