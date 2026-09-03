import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

import { mapCheckoutError } from "./checkout-errors";
import { getLocalCheckoutReturnUrlBase } from "./local-checkout-return-url";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SHARED_NOTE_LENGTH = 600;

type CheckoutPayload = {
  ok: true;
  data: {
    bookingId: string;
    clientSecret: string | null;
    checkoutSessionId: string;
    currency: string;
    discountAmountCents: number;
    holdExpiresAt: string;
    holdId: string;
    mode: "initial_hold" | "payment_retry";
    originalAmountCents: number;
    promotion: PromotionSummary | null;
    sessionPaymentId: string;
    totalAmountCents: number;
    url: string | null;
    reservationExpiresAt: string | null;
    serverNow: string;
  };
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
    return NextResponse.json(
      { ok: false, message: "Envie os dados da reserva em formato válido." },
      { status: 400 },
    );
  }

  const input = toCheckoutInput(body);
  const returnUrlBase = getLocalCheckoutReturnUrlBase(request);
  if (input.action === "replace") {
    return replaceCheckout(input, returnUrlBase);
  }
  if (input.action === "retry") {
    return retryCheckout(input, returnUrlBase);
  }

  if (
    !UUID.test(input.checkoutAttemptId) ||
    !UUID.test(input.serviceId) ||
    !isIsoInstant(input.startsAt)
  ) {
    return NextResponse.json(
      { ok: false, message: "Revise os dados da reserva." },
      { status: 422 },
    );
  }
  if (!input.termsAccepted) {
    return NextResponse.json(
      {
        code: "TERMS_REQUIRED",
        ok: false,
        message: "Aceite os termos para continuar para o pagamento.",
      },
      { status: 428 },
    );
  }
  if (
    input.sharedNote !== null &&
    input.sharedNote.length > MAX_SHARED_NOTE_LENGTH
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Revise o texto compartilhado antes de continuar.",
      },
      { status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Configuração pública do Supabase ausente. Não foi possível iniciar o pagamento.",
      },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Entre na sua conta de cliente para continuar.",
      },
      { status: 401 },
    );
  }

  try {
    const response = await invokeSupabaseFunction<CheckoutPayload>(
      config,
      "session-booking-checkout",
      {
        accessToken,
        body: {
          holdTtlSeconds: 300,
          requestId: input.checkoutAttemptId,
          returnUrlBase,
          serviceId: input.serviceId,
          sharedNote: input.sharedNote,
          startsAt: new Date(input.startsAt).toISOString(),
          termsAccepted: true,
        },
      },
    );

    if (!response.data.clientSecret) {
      return NextResponse.json(
        {
          code: "CHECKOUT_CLIENT_SECRET_MISSING",
          ok: false,
          message:
            "Não conseguimos carregar o checkout incorporado agora. Tente novamente.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      checkout: {
        bookingId: response.data.bookingId,
        checkoutSessionId: response.data.checkoutSessionId,
        clientSecret: response.data.clientSecret,
        currency: response.data.currency,
        discountAmountCents: response.data.discountAmountCents,
        holdExpiresAt: response.data.holdExpiresAt,
        holdId: response.data.holdId,
        mode: response.data.mode,
        originalAmountCents: response.data.originalAmountCents,
        promotion: response.data.promotion,
        sessionPaymentId: response.data.sessionPaymentId,
        totalAmountCents: response.data.totalAmountCents,
        reservationExpiresAt: response.data.reservationExpiresAt,
        serverNow: response.data.serverNow,
      },
      ok: true,
    });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      const mapped = mapCheckoutError(error);
      return NextResponse.json(
        {
          code: mapped.code,
          ok: false,
          message: mapped.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        ok: false,
        message: "Não conseguimos iniciar o pagamento agora.",
      },
      { status: 500 },
    );
  }
}

function toCheckoutInput(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    action:
      record.action === "replace"
        ? "replace"
        : record.action === "retry"
          ? "retry"
          : "create",
    bookingId: asString(record.bookingId),
    checkoutAttemptId: asString(record.checkoutAttemptId ?? record.requestId),
    promotionCode:
      record.promotionCode === null ? null : asString(record.promotionCode),
    replaceCheckoutSessionId: asString(record.replaceCheckoutSessionId),
    serviceId: asString(record.serviceId),
    sharedNote: normalizeSharedNote(record.sharedNote),
    startsAt: asString(record.startsAt),
    termsAccepted: record.termsAccepted === true,
  };
}

function normalizeSharedNote(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

type CheckoutInput = ReturnType<typeof toCheckoutInput>;

async function retryCheckout(
  input: CheckoutInput,
  returnUrlBase: string | null,
) {
  if (!UUID.test(input.bookingId) || !UUID.test(input.checkoutAttemptId)) {
    return NextResponse.json(
      { ok: false, message: "Revise os dados do pagamento." },
      { status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_patient_access_token")?.value;
  if (!config || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "Entre na sua conta de cliente para continuar." },
      { status: 401 },
    );
  }

  try {
    const response = await invokeSupabaseFunction<{
      data: Omit<CheckoutPayload["data"], "holdExpiresAt" | "holdId">;
      ok: true;
    }>(config, "stripe-create-session-payment", {
      accessToken,
      body: {
        attemptKind: "payment_retry",
        bookingId: input.bookingId,
        checkoutAttemptId: input.checkoutAttemptId,
        returnUrlBase,
      },
    });
    if (!response.data.clientSecret) {
      throw new SupabaseFunctionError(
        "stripe-create-session-payment",
        502,
        "checkout_client_secret_missing",
      );
    }
    return NextResponse.json({ checkout: response.data, ok: true });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      const mapped = mapCheckoutError(error);
      return NextResponse.json(
        { code: mapped.code, message: mapped.message, ok: false },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, message: "Não foi possível retomar o pagamento agora." },
      { status: 500 },
    );
  }
}

async function replaceCheckout(
  input: CheckoutInput,
  returnUrlBase: string | null,
) {
  if (
    !UUID.test(input.bookingId) ||
    !UUID.test(input.checkoutAttemptId) ||
    !input.replaceCheckoutSessionId.startsWith("cs_") ||
    (input.promotionCode !== null && !input.promotionCode.trim())
  ) {
    return NextResponse.json(
      { ok: false, message: "Revise o código promocional." },
      { status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  if (!config || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "Entre na sua conta de cliente para continuar." },
      { status: 401 },
    );
  }

  try {
    const response = await invokeSupabaseFunction<{
      data: Omit<
        CheckoutPayload["data"],
        "bookingId" | "holdExpiresAt" | "holdId"
      >;
      ok: true;
    }>(config, "stripe-create-session-payment", {
      accessToken,
      body: {
        bookingId: input.bookingId,
        checkoutAttemptId: input.checkoutAttemptId,
        promotionCode: input.promotionCode,
        replaceCheckoutSessionId: input.replaceCheckoutSessionId,
        returnUrlBase,
      },
    });

    if (!response.data.clientSecret) {
      throw new SupabaseFunctionError(
        "stripe-create-session-payment",
        502,
        "checkout_client_secret_missing",
      );
    }

    return NextResponse.json({ checkout: response.data, ok: true });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      const mapped = mapPromotionError(error);
      return NextResponse.json(
        { code: mapped.code, message: mapped.message, ok: false },
        { status: mapped.status },
      );
    }
    return NextResponse.json(
      { ok: false, message: "Não foi possível atualizar o pagamento agora." },
      { status: 500 },
    );
  }
}

function mapPromotionError(error: SupabaseFunctionError) {
  if (error.status === 409 && error.code === "patient_schedule_conflict") {
    return {
      code: "PATIENT_SCHEDULE_CONFLICT",
      message:
        "Você já tem outro encontro nesse horário. Escolha outro momento.",
      status: 409,
    };
  }
  if (error.status === 422) {
    return {
      code: error.code ?? "PROMOTION_INVALID",
      message: error.message || "Código promocional inválido ou indisponível.",
      status: 422,
    };
  }
  if (error.status === 409) {
    return {
      code: error.code ?? "CHECKOUT_CONFLICT",
      message: error.message || "O pagamento foi atualizado. Tente novamente.",
      status: 409,
    };
  }
  return {
    code: "PROMOTION_UNAVAILABLE",
    message: "Não foi possível validar o código promocional agora.",
    status: error.status >= 400 ? error.status : 502,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isIsoInstant(value: string) {
  const date = new Date(value);
  return Boolean(value && !Number.isNaN(date.getTime()));
}
