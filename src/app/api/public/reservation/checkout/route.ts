import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutPayload = {
  ok: true;
  data: {
    bookingId: string;
    clientSecret: string | null;
    checkoutSessionId: string;
    holdExpiresAt: string;
    holdId: string;
    sessionPaymentId: string;
    url: string | null;
  };
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
  if (
    !UUID.test(input.requestId) ||
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
          holdTtlSeconds: 600,
          requestId: input.requestId,
          serviceId: input.serviceId,
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
        holdExpiresAt: response.data.holdExpiresAt,
        holdId: response.data.holdId,
        sessionPaymentId: response.data.sessionPaymentId,
      },
      ok: true,
    });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      const mapped = mapCheckoutError(error.status);
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
    requestId: asString(record.requestId),
    serviceId: asString(record.serviceId),
    startsAt: asString(record.startsAt),
    termsAccepted: record.termsAccepted === true,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isIsoInstant(value: string) {
  const date = new Date(value);
  return Boolean(value && !Number.isNaN(date.getTime()));
}

function mapCheckoutError(status: number) {
  if (status === 401) {
    return {
      code: "UNAUTHENTICATED",
      message: "Entre na sua conta de cliente para continuar.",
    };
  }
  if (status === 403) {
    return {
      code: "FORBIDDEN",
      message: "Use o acesso correspondente ao seu perfil.",
    };
  }
  if (status === 409) {
    return {
      code: "SLOT_CONFLICT",
      message: "Este horário não está mais disponível. Escolha outro momento.",
    };
  }
  if (status === 422) {
    return { code: "INVALID_REQUEST", message: "Revise os dados da reserva." };
  }
  if (status === 428) {
    return {
      code: "LEGAL_DOCUMENTS_REQUIRED",
      message: "Não foi possível iniciar a reserva agora.",
    };
  }
  if (status === 503) {
    return {
      code: "STRIPE_CONFIGURATION_ERROR",
      message: "O pagamento está temporariamente indisponível neste ambiente.",
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "Não conseguimos iniciar o pagamento agora.",
  };
}
