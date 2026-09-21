import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  parseRecoveryBody,
  validateRecoveryPaymentIntent,
} from "./recovery-command.ts";

type BookingRow = {
  id: string;
  patient_profile_id: string;
};

type ScheduleRow = {
  booking_id: string;
  booking_version: number;
  id: string;
  session_payment_id: string;
  session_payment_setup_id: string;
  status: string;
  stripe_environment: "live" | "test";
  stripe_payment_intent_id: string | null;
};

type PaymentRow = {
  currency: string;
  gross_amount_cents: number;
  id: string;
};

type SetupRow = {
  stripe_customer_id: string;
};

const runtime = getPaymentsRuntime("prepare-session-charge-recovery");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Método não permitido.");
    }

    const config = getPaymentsConfig(runtime);
    if (!config.sessionFinancialFlowV10Enabled) {
      throw new DomainError(
        "session_charge_recovery_unavailable",
        503,
        "A confirmação do pagamento está indisponível agora.",
      );
    }

    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const { profile: patient } = await requirePatient(client, request);
    const { bookingId } = parseRecoveryBody(
      await parseJsonBody<unknown>(request),
    );

    const bookings = await client.get<BookingRow[]>(
      `/rest/v1/bookings?select=id,patient_profile_id&id=eq.${encodeURIComponent(bookingId)}&patient_profile_id=eq.${encodeURIComponent(patient.id)}&limit=1`,
    );
    if (!bookings[0]) {
      throw new DomainError(
        "session_not_found",
        404,
        "Encontro não encontrado.",
      );
    }

    const schedules = await client.get<ScheduleRow[]>(
      `/rest/v1/session_payment_schedules?select=id,booking_id,booking_version,session_payment_id,session_payment_setup_id,stripe_environment,status,stripe_payment_intent_id&booking_id=eq.${encodeURIComponent(bookingId)}&order=created_at.desc&limit=1`,
    );
    const schedule = schedules[0];
    if (
      !schedule ||
      schedule.status !== "requires_customer_action" ||
      !schedule.stripe_payment_intent_id
    ) {
      throw new DomainError(
        "session_charge_recovery_not_available",
        409,
        "Este pagamento não precisa de uma nova confirmação.",
      );
    }

    const [payments, setups] = await Promise.all([
      client.get<PaymentRow[]>(
        `/rest/v1/session_payments?select=id,gross_amount_cents,currency&id=eq.${encodeURIComponent(schedule.session_payment_id)}&limit=1`,
      ),
      client.get<SetupRow[]>(
        `/rest/v1/session_payment_setups?select=stripe_customer_id&id=eq.${encodeURIComponent(schedule.session_payment_setup_id)}&limit=1`,
      ),
    ]);
    const payment = payments[0];
    const setup = setups[0];
    if (
      !payment ||
      !setup ||
      schedule.stripe_environment !== config.environment
    ) {
      throw new DomainError(
        "session_charge_recovery_binding_mismatch",
        409,
        "Não foi possível validar este pagamento. Fale com o suporte.",
      );
    }

    const stripe = createStripeClient(config.stripeApiKey);
    const intent = await stripe.paymentIntents.retrieve(
      schedule.stripe_payment_intent_id,
    );
    const recovery = validateRecoveryPaymentIntent(
      {
        amountCents: payment.gross_amount_cents,
        bookingId,
        bookingVersion: schedule.booking_version,
        currency: payment.currency,
        environment: schedule.stripe_environment,
        patientProfileId: patient.id,
        scheduleId: schedule.id,
        sessionPaymentId: payment.id,
        stripeCustomerId: setup.stripe_customer_id,
        stripePaymentIntentId: schedule.stripe_payment_intent_id,
      },
      intent,
    );

    await client.rpc("begin_session_charge_recovery_v10", {
      p_booking_id: bookingId,
      p_patient_profile_id: patient.id,
      p_schedule_id: schedule.id,
      p_stripe_payment_intent_id: schedule.stripe_payment_intent_id,
    });

    return success(recovery);
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
