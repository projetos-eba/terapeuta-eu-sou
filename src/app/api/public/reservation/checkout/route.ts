import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";
import { routes } from "@/lib/routes";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type CheckoutPayload = {
  ok: true;
  data: {
    bookingId: string;
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
        },
      },
    );

    return NextResponse.json({
      ok: true,
      redirectTo:
        response.data.url ??
        `${routes.public.reservationSuccess}?booking=${encodeURIComponent(
          response.data.bookingId,
        )}`,
    });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      return NextResponse.json(
        {
          ok: false,
          message: mapCheckoutError(error.status),
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
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
  if (status === 401) return "Entre na sua conta de cliente para continuar.";
  if (status === 403) return "Use o acesso correspondente ao seu perfil.";
  if (status === 409) {
    return "Este horário não está mais disponível. Escolha outro momento.";
  }
  if (status === 422) return "Revise os dados da reserva.";
  if (status === 503) {
    return "O pagamento está temporariamente indisponível neste ambiente.";
  }
  return "Não conseguimos iniciar o pagamento agora.";
}
