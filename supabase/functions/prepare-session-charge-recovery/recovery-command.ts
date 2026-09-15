import { DomainError } from "../_shared/payments/http.ts";

export type SessionChargeRecoveryContext = {
  amountCents: number;
  bookingId: string;
  bookingVersion: number;
  currency: string;
  environment: "live" | "test";
  patientProfileId: string;
  scheduleId: string;
  sessionPaymentId: string;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
};

type RecoveryPaymentIntent = {
  amount: number;
  client_secret: string | null;
  currency: string;
  customer: string | { id: string } | null;
  id: string;
  livemode: boolean;
  metadata: Record<string, string>;
  status: string;
};

export function validateRecoveryPaymentIntent(
  context: SessionChargeRecoveryContext,
  intent: RecoveryPaymentIntent,
) {
  const customerId =
    typeof intent.customer === "string"
      ? intent.customer
      : (intent.customer?.id ?? null);
  const expectedLiveMode = context.environment === "live";

  if (
    intent.id !== context.stripePaymentIntentId ||
    intent.livemode !== expectedLiveMode ||
    intent.amount !== context.amountCents ||
    intent.currency.toLowerCase() !== context.currency.toLowerCase() ||
    customerId !== context.stripeCustomerId ||
    intent.metadata.payment_type !== "therapy_session" ||
    intent.metadata.tes_checkout_mode !== "t24_charge" ||
    intent.metadata.tes_payment_flow_version !== "v10" ||
    intent.metadata.tes_session_id !== context.bookingId ||
    intent.metadata.tes_booking_version !== String(context.bookingVersion) ||
    intent.metadata.tes_session_payment_id !== context.sessionPaymentId ||
    intent.metadata.tes_schedule_id !== context.scheduleId
  ) {
    throw new DomainError(
      "session_charge_recovery_binding_mismatch",
      409,
      "Não foi possível validar este pagamento. Fale com o suporte.",
    );
  }

  if (
    intent.status !== "requires_action" &&
    intent.status !== "requires_payment_method"
  ) {
    throw new DomainError(
      "session_charge_recovery_not_available",
      409,
      "Este pagamento não precisa de uma nova confirmação.",
    );
  }

  if (!intent.client_secret) {
    throw new DomainError(
      "session_charge_recovery_unavailable",
      503,
      "Não foi possível abrir a confirmação do pagamento agora.",
    );
  }

  return {
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}

export function parseRecoveryBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(
      "invalid_request",
      422,
      "Revise os dados do encontro.",
    );
  }

  const bookingId = Reflect.get(value, "bookingId");
  if (
    typeof bookingId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    throw new DomainError(
      "invalid_request",
      422,
      "Revise os dados do encontro.",
    );
  }

  return { bookingId };
}
