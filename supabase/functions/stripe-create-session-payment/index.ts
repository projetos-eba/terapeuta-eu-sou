import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import { calculateCommissionSnapshot } from "../_shared/payments/money.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = {
  bookingId?: string;
};

type BookingRow = {
  currency_snapshot: string;
  id: string;
  patient_profile_id: string;
  service_duration_minutes_snapshot: number;
  service_id: string;
  service_price_cents_snapshot: number;
  service_title_snapshot: string;
  status: string;
  therapist_profile_id: string;
  therapist_profiles: {
    is_accepting_bookings: boolean;
    status: string;
  } | null;
};

const runtime = getPaymentsRuntime("stripe-create-session-payment");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const { profile: patient, user } = await requirePatient(client, request);
    const body = await parseJsonBody<Body>(request);
    const bookingId = requireUuid(body.bookingId, "booking_id");
    const checkoutUiMode = "embedded";
    const booking = await getBooking(client, bookingId);

    if (booking.patient_profile_id !== patient.id) {
      throw new DomainError(
        "booking_forbidden",
        403,
        "Reserva nao pertence a esta conta.",
      );
    }

    if (!["draft", "pending_payment"].includes(booking.status)) {
      throw new DomainError(
        "booking_not_payable",
        409,
        "Esta reserva nao pode ser paga agora.",
      );
    }

    if (
      booking.therapist_profiles?.status !== "approved" ||
      !booking.therapist_profiles.is_accepting_bookings
    ) {
      throw new DomainError(
        "therapist_unavailable",
        409,
        "Este terapeuta nao esta disponivel para novas reservas.",
      );
    }

    if (booking.service_price_cents_snapshot <= 0) {
      throw new DomainError(
        "service_price_missing",
        409,
        "Preco do servico nao encontrado.",
      );
    }

    const policy = await getActivePolicy(client);
    const snapshot = calculateCommissionSnapshot({
      grossAmountCents: booking.service_price_cents_snapshot,
      platformCommissionBps: policy.platform_commission_bps,
    });
    const customer = await getOrCreatePatientCustomer({
      client,
      environment: config.environment,
      patient,
      stripe,
      userId: user.id,
    });
    const sessionPayment = await getOrCreateSessionPayment(client, {
      booking,
      customerId: customer.id,
      policyId: policy.id,
      snapshot,
    });
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "session_payment",
      checkoutUiMode,
      booking.id,
      sessionPayment.id,
    ]);
    const checkoutSessionParams = {
      client_reference_id: booking.id,
      customer: customer.stripe_customer_id,
      line_items: [
        {
          price_data: {
            currency: booking.currency_snapshot.toLowerCase(),
            product_data: {
              metadata: {
                stripe_mode: config.stripeMode,
                system: "tes",
                tes_service_id: booking.service_id,
              },
              name: booking.service_title_snapshot,
            },
            unit_amount: snapshot.grossAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        environment: config.environment,
        payment_type: "therapy_session",
        stripe_mode: config.stripeMode,
        system: "tes",
        tes_patient_id: patient.id,
        tes_session_id: booking.id,
        tes_session_payment_id: sessionPayment.id,
        tes_therapist_id: booking.therapist_profile_id,
      },
      allow_promotion_codes: true,
      mode: "payment" as const,
      payment_intent_data: {
        metadata: {
          environment: config.environment,
          payment_type: "therapy_session",
          stripe_mode: config.stripeMode,
          system: "tes",
          tes_patient_id: patient.id,
          tes_session_id: booking.id,
          tes_session_payment_id: sessionPayment.id,
          tes_therapist_id: booking.therapist_profile_id,
        },
        transfer_group: `tes_booking_${booking.id}`,
      },
      return_url: `${config.siteUrl}/reserva/sucesso?booking=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      ui_mode: "embedded_page" as const,
    };
    const checkout = await stripe.checkout.sessions.create(
      checkoutSessionParams,
      { idempotencyKey },
    );

    await client.patch(
      `/rest/v1/session_payments?id=eq.${encodeURIComponent(sessionPayment.id)}`,
      {
        stripe_checkout_session_id: checkout.id,
        updated_at: new Date().toISOString(),
      },
      "return=minimal",
    );
    await client.post(
      "/rest/v1/session_payment_attempts?on_conflict=idempotency_key",
      {
        idempotency_key: idempotencyKey,
        session_payment_id: sessionPayment.id,
        status: "checkout_created",
        stripe_checkout_session_id: checkout.id,
      },
      "resolution=merge-duplicates,return=minimal",
    );
    return success({
      clientSecret: checkout.client_secret ?? null,
      checkoutSessionId: checkout.id,
      sessionPaymentId: sessionPayment.id,
      url: checkout.url,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

function requireUuid(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError(code, 422, "Identificador invalido.");
  }

  return value;
}

async function getBooking(client: SupabaseRestClient, bookingId: string) {
  const rows = await client.get<BookingRow[]>(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,status,service_title_snapshot,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot,therapist_profiles(status,is_accepting_bookings)&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError("booking_not_found", 404, "Reserva nao encontrada.");
  }

  return rows[0];
}

async function getActivePolicy(client: SupabaseRestClient) {
  const rows = await client.get<
    Array<{ id: string; platform_commission_bps: number }>
  >(
    "/rest/v1/financial_policy_versions?select=id,platform_commission_bps&is_active=eq.true&limit=1",
  );

  if (!rows[0]) {
    throw new DomainError(
      "financial_policy_missing",
      503,
      "Politica financeira nao encontrada.",
    );
  }

  return rows[0];
}

async function getOrCreatePatientCustomer(input: {
  client: SupabaseRestClient;
  environment: string;
  patient: { display_name: string; id: string };
  stripe: ReturnType<typeof createStripeClient>;
  userId: string;
}) {
  const existing = await input.client.get<
    Array<{ id: string; stripe_customer_id: string }>
  >(
    `/rest/v1/stripe_customers?select=id,stripe_customer_id&patient_profile_id=eq.${encodeURIComponent(
      input.patient.id,
    )}&role=eq.patient&environment=eq.${encodeURIComponent(input.environment)}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const profileRows = await input.client.get<Array<{ email: string | null }>>(
    `/rest/v1/profiles?select=email&id=eq.${encodeURIComponent(input.userId)}&limit=1`,
  );
  const customer = await input.stripe.customers.create({
    email: profileRows[0]?.email ?? undefined,
    metadata: {
      environment: input.environment,
      role: "patient",
      stripe_mode: input.environment,
      system: "tes",
      tes_patient_id: input.patient.id,
      user_id: input.userId,
    },
    name: input.patient.display_name,
  });
  const inserted = await input.client.post<
    Array<{ id: string; stripe_customer_id: string }>
  >(
    "/rest/v1/stripe_customers?select=id,stripe_customer_id",
    {
      email: profileRows[0]?.email ?? null,
      environment: input.environment,
      livemode: customer.livemode,
      patient_profile_id: input.patient.id,
      profile_id: input.userId,
      role: "patient",
      stripe_customer_id: customer.id,
    },
    "return=representation",
  );

  return inserted[0];
}

async function getOrCreateSessionPayment(
  client: SupabaseRestClient,
  input: {
    booking: BookingRow;
    customerId: string;
    policyId: string;
    snapshot: ReturnType<typeof calculateCommissionSnapshot>;
  },
) {
  const existing = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&booking_id=eq.${encodeURIComponent(input.booking.id)}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const inserted = await client.post<Array<{ id: string }>>(
    "/rest/v1/session_payments?select=id",
    {
      booking_id: input.booking.id,
      gross_amount_cents: input.snapshot.grossAmountCents,
      patient_profile_id: input.booking.patient_profile_id,
      platform_commission_bps: input.snapshot.platformCommissionBps,
      platform_gross_commission_cents:
        input.snapshot.platformGrossCommissionCents,
      policy_version_id: input.policyId,
      service_id: input.booking.service_id,
      stripe_customer_id: input.customerId,
      therapist_amount_cents: input.snapshot.therapistAmountCents,
      therapist_profile_id: input.booking.therapist_profile_id,
    },
    "return=representation",
  );

  return inserted[0];
}

export {};
