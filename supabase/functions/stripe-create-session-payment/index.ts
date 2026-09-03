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
  checkoutAmounts,
  mapPromotionStripeError,
  type PromotionSummary,
  resolvePromotionCode,
} from "../_shared/payments/promotion-codes.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import { resolveCheckoutReturnUrlBase } from "./checkout-return-url.ts";

type Body = {
  attemptKind?: "initial_hold" | "payment_retry";
  bookingId?: string;
  bookingHoldId?: string;
  checkoutAttemptId?: string;
  promotionCode?: string | null;
  replaceCheckoutSessionId?: string | null;
  reservationExpiresAt?: string | null;
  returnUrlBase?: string | null;
};

type ReservationCheckoutMode = "initial_hold" | "payment_retry";

type AttemptRow = {
  attempt_kind: string;
  booking_hold_id: string | null;
  reservation_expires_at: string | null;
};

type SessionPaymentRow = {
  id: string;
  stripe_checkout_session_id: string | null;
};

type BookingRow = {
  currency_snapshot: string;
  id: string;
  patient_profile_id: string;
  service_duration_minutes_snapshot: number;
  service_id: string;
  service_price_cents_snapshot: number;
  service_title_snapshot: string;
  starts_at: string;
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
    const checkoutReturnUrlBase = resolveCheckoutReturnUrlBase({
      configuredSiteUrl: config.siteUrl,
      requestedReturnUrlBase: body.returnUrlBase,
      stripeMode: config.stripeMode,
    });
    const bookingId = requireUuid(body.bookingId, "booking_id");
    const checkoutAttemptId = requireUuid(
      body.checkoutAttemptId,
      "checkout_attempt_id",
    );
    const replaceCheckoutSessionId = optionalStripeId(
      body.replaceCheckoutSessionId,
      "cs_",
      "replace_checkout_session_id",
    );
    const checkoutUiMode = "embedded";
    const booking = await getBooking(client, bookingId);

    if (booking.patient_profile_id !== patient.id) {
      throw new DomainError(
        "booking_forbidden",
        403,
        "Reserva nao pertence a esta conta.",
      );
    }

    if (
      !["draft", "pending_payment", "cancelled_by_payment"].includes(
        booking.status,
      )
    ) {
      throw new DomainError(
        "booking_not_payable",
        409,
        "Esta reserva nao pode ser paga agora.",
      );
    }

    const replacedAttempt = replaceCheckoutSessionId
      ? await getAttemptByCheckout(client, replaceCheckoutSessionId)
      : null;
    const mode: ReservationCheckoutMode = replacedAttempt
      ? requireAttemptKind(replacedAttempt.attempt_kind)
      : booking.status === "cancelled_by_payment"
        ? "payment_retry"
        : "initial_hold";
    const bookingHoldId =
      replacedAttempt?.booking_hold_id ??
      optionalUuid(body.bookingHoldId, "booking_hold_id");
    const reservationExpiresAt =
      replacedAttempt?.reservation_expires_at ??
      optionalIsoInstant(body.reservationExpiresAt, "reservation_expires_at");

    if (mode === "initial_hold") {
      await assertInitialHoldAttempt(client, {
        bookingHoldId,
        bookingId,
        reservationExpiresAt,
      });
    } else {
      const preflight = await client.rpc<{
        allowed?: boolean;
        reason?: string;
      }>("preflight_session_payment_retry_v1", { p_booking_id: bookingId });
      if (!preflight?.allowed) {
        const patientConflict =
          preflight?.reason === "patient_schedule_conflict";
        const slotConflict = preflight?.reason === "slot_conflict";
        throw new DomainError(
          patientConflict
            ? "patient_schedule_conflict"
            : slotConflict
              ? "slot_not_available"
              : "booking_not_payable",
          409,
          patientConflict
            ? "Você já tem outro encontro nesse horário. Escolha outro momento."
            : slotConflict
              ? "Este horário já está sendo reservado. Escolha outro horário."
              : "Este pagamento não pode ser retomado agora.",
        );
      }
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
    const replacementAlreadyApplied = Boolean(
      replaceCheckoutSessionId &&
      sessionPayment.stripe_checkout_session_id !== replaceCheckoutSessionId,
    );
    const previousCheckout =
      replaceCheckoutSessionId && !replacementAlreadyApplied
        ? await validateReplacementCheckout({
            booking,
            checkoutSessionId: replaceCheckoutSessionId,
            customerId: customer.stripe_customer_id,
            environment: config.environment,
            sessionPayment,
            stripe,
            stripeMode: config.stripeMode,
          })
        : null;
    const promotion = body.promotionCode
      ? await resolvePromotionCode({
          checkoutScope: "session",
          code: body.promotionCode,
          currency: booking.currency_snapshot,
          customerId: customer.stripe_customer_id,
          originalAmountCents: snapshot.grossAmountCents,
          stripe,
        })
      : null;
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "session_payment_v2",
      checkoutUiMode,
      mode,
      booking.id,
      sessionPayment.id,
      checkoutAttemptId,
      promotion?.promotionCodeId ?? "no_promotion",
    ]);
    const integrationIdentifier = createIdempotencyKey([
      "tes_session",
      booking.id,
      checkoutAttemptId,
    ])
      .replace(/:/g, "_")
      .slice(0, 64);

    if (replacementAlreadyApplied) {
      const attempts = await client.get<
        Array<{ stripe_checkout_session_id: string | null }>
      >(
        `/rest/v1/session_payment_attempts?select=stripe_checkout_session_id&idempotency_key=eq.${encodeURIComponent(
          idempotencyKey,
        )}&limit=1`,
      );
      const retriedCheckoutId = attempts[0]?.stripe_checkout_session_id ?? null;
      if (
        !retriedCheckoutId ||
        retriedCheckoutId !== sessionPayment.stripe_checkout_session_id
      ) {
        throw new DomainError(
          "checkout_replacement_conflict",
          409,
          "O pagamento foi atualizado em outra tentativa. Recarregue para continuar.",
        );
      }
      const retriedCheckout = await validateReplacementCheckout({
        booking,
        checkoutSessionId: retriedCheckoutId,
        customerId: customer.stripe_customer_id,
        environment: config.environment,
        sessionPayment,
        stripe,
        stripeMode: config.stripeMode,
      });
      return success({
        bookingId: booking.id,
        clientSecret: retriedCheckout.client_secret ?? null,
        checkoutSessionId: retriedCheckout.id,
        ...checkoutAmounts(retriedCheckout),
        mode,
        promotion: promotion?.summary ?? null,
        reservationExpiresAt:
          mode === "initial_hold" ? reservationExpiresAt : null,
        serverNow: new Date().toISOString(),
        sessionPaymentId: sessionPayment.id,
        url: retriedCheckout.url,
      });
    }
    const checkoutSessionParams = {
      client_reference_id: booking.id,
      customer: customer.stripe_customer_id,
      integration_identifier: integrationIdentifier,
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
        tes_checkout_mode: mode,
        tes_patient_id: patient.id,
        tes_session_id: booking.id,
        tes_session_payment_id: sessionPayment.id,
        tes_therapist_id: booking.therapist_profile_id,
        ...(promotion
          ? { tes_promotion_code_id: promotion.promotionCodeId }
          : {}),
      },
      ...(promotion
        ? { discounts: [{ promotion_code: promotion.promotionCodeId }] }
        : {}),
      locale: "pt-BR" as const,
      mode: "payment" as const,
      payment_intent_data: {
        capture_method: "manual" as const,
        metadata: {
          environment: config.environment,
          payment_type: "therapy_session",
          stripe_mode: config.stripeMode,
          system: "tes",
          tes_checkout_mode: mode,
          tes_patient_id: patient.id,
          tes_session_id: booking.id,
          tes_session_payment_id: sessionPayment.id,
          tes_therapist_id: booking.therapist_profile_id,
        },
        transfer_group: `tes_booking_${booking.id}`,
      },
      return_url: `${checkoutReturnUrlBase}/reserva/sucesso?booking=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      ui_mode: "embedded_page" as const,
    };
    let checkout: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      checkout = await stripe.checkout.sessions.create(checkoutSessionParams, {
        idempotencyKey,
      });
    } catch (error) {
      throw mapPromotionStripeError(error) ?? error;
    }

    const amounts = checkoutAmounts(checkout);
    // Stripe supports no-cost one-time Checkout Sessions. Keep the session
    // open so Embedded Checkout can confirm the free booking and emit the
    // signed checkout.session.completed webhook. The webhook remains the
    // only authority that marks session_payments/bookings as paid.

    const compareCheckoutId =
      replaceCheckoutSessionId ?? sessionPayment.stripe_checkout_session_id;
    const updatedPayments = await client.patch<SessionPaymentRow[]>(
      `/rest/v1/session_payments?select=id,stripe_checkout_session_id&id=eq.${encodeURIComponent(
        sessionPayment.id,
      )}&stripe_checkout_session_id=${
        compareCheckoutId
          ? `eq.${encodeURIComponent(compareCheckoutId)}`
          : "is.null"
      }`,
      {
        stripe_checkout_session_id: checkout.id,
        updated_at: new Date().toISOString(),
      },
      "return=representation",
    );
    const didSwapCheckout = Boolean(updatedPayments[0]);
    if (!didSwapCheckout) {
      const currentPayment = await getSessionPayment(client, sessionPayment.id);
      if (currentPayment?.stripe_checkout_session_id !== checkout.id) {
        await expireCheckoutQuietly(stripe, checkout.id);
        throw new DomainError(
          "checkout_replacement_conflict",
          409,
          "O pagamento foi atualizado em outra tentativa. Recarregue para continuar.",
        );
      }
    }
    await client.post(
      "/rest/v1/session_payment_attempts?on_conflict=idempotency_key",
      {
        attempt_kind: mode,
        booking_hold_id: bookingHoldId,
        idempotency_key: idempotencyKey,
        reservation_expires_at:
          mode === "initial_hold" ? reservationExpiresAt : null,
        session_payment_id: sessionPayment.id,
        status: "checkout_created",
        stripe_checkout_session_id: checkout.id,
        request_metadata: {
          checkout_attempt_id: checkoutAttemptId,
          checkout_mode: mode,
          has_promotion: Boolean(promotion),
          replaces_checkout_session_id: replaceCheckoutSessionId,
        },
        response_metadata: amounts,
      },
      "resolution=merge-duplicates,return=minimal",
    );

    if (previousCheckout && didSwapCheckout) {
      await markAttemptSuperseded(client, previousCheckout.id);
      const expired = await expireCheckoutQuietly(stripe, previousCheckout.id);
      if (!expired) {
        await markAttemptSuperseded(client, checkout.id);
        await expireCheckoutQuietly(stripe, checkout.id);
        await restoreCurrentCheckout({
          client,
          currentCheckoutId: checkout.id,
          previousCheckoutId: previousCheckout.id,
          sessionPaymentId: sessionPayment.id,
        });
        await updateAttemptStatus(
          client,
          previousCheckout.id,
          "checkout_created",
        );
        let previousIsConfirming = false;
        try {
          const latestPrevious = await stripe.checkout.sessions.retrieve(
            previousCheckout.id,
          );
          previousIsConfirming =
            latestPrevious.status === "complete" ||
            latestPrevious.payment_status === "paid";
        } catch {
          // The rollback above remains authoritative when Stripe is unavailable.
        }
        throw new DomainError(
          previousIsConfirming
            ? "checkout_already_confirming"
            : "checkout_replacement_conflict",
          409,
          previousIsConfirming
            ? "O pagamento anterior já está sendo confirmado."
            : "Não foi possível atualizar o pagamento. Tente novamente.",
        );
      }
    }

    return success({
      bookingId: booking.id,
      clientSecret: checkout.client_secret ?? null,
      checkoutSessionId: checkout.id,
      ...amounts,
      mode,
      promotion: promotion?.summary ?? null,
      reservationExpiresAt:
        mode === "initial_hold" ? reservationExpiresAt : null,
      serverNow: new Date().toISOString(),
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

function optionalStripeId(value: unknown, prefix: string, code: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    throw new DomainError(code, 422, "Identificador inválido.");
  }
  return value;
}

function optionalUuid(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, code);
}

function optionalIsoInstant(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    throw new DomainError(code, 422, "Prazo da reserva inválido.");
  }
  return new Date(value).toISOString();
}

async function getBooking(client: SupabaseRestClient, bookingId: string) {
  const rows = await client.get<BookingRow[]>(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,status,starts_at,service_title_snapshot,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot,therapist_profiles(status,is_accepting_bookings)&id=eq.${encodeURIComponent(
      bookingId,
    )}&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError("booking_not_found", 404, "Reserva nao encontrada.");
  }

  return rows[0];
}

async function getAttemptByCheckout(
  client: SupabaseRestClient,
  checkoutSessionId: string,
) {
  const rows = await client.get<AttemptRow[]>(
    `/rest/v1/session_payment_attempts?select=attempt_kind,booking_hold_id,reservation_expires_at&stripe_checkout_session_id=eq.${encodeURIComponent(
      checkoutSessionId,
    )}&limit=1`,
  );
  if (!rows[0]) {
    throw new DomainError(
      "checkout_replacement_forbidden",
      409,
      "Este pagamento não pode mais ser atualizado.",
    );
  }
  return rows[0];
}

function requireAttemptKind(value: string): ReservationCheckoutMode {
  if (value === "initial_hold" || value === "payment_retry") return value;
  throw new DomainError(
    "checkout_replacement_forbidden",
    409,
    "Este pagamento não pode mais ser atualizado.",
  );
}

async function assertInitialHoldAttempt(
  client: SupabaseRestClient,
  input: {
    bookingHoldId: string | null;
    bookingId: string;
    reservationExpiresAt: string | null;
  },
) {
  if (!input.bookingHoldId || !input.reservationExpiresAt) {
    throw new DomainError(
      "initial_hold_required",
      409,
      "Reinicie a reserva para abrir o pagamento seguro.",
    );
  }
  const rows = await client.get<Array<{ expires_at: string }>>(
    `/rest/v1/booking_holds?select=expires_at&id=eq.${encodeURIComponent(
      input.bookingHoldId,
    )}&consumed_booking_id=eq.${encodeURIComponent(
      input.bookingId,
    )}&status=eq.consumed&limit=1`,
  );
  const expiresAt = rows[0]?.expires_at;
  if (
    !expiresAt ||
    new Date(expiresAt).getTime() !==
      new Date(input.reservationExpiresAt).getTime() ||
    new Date(expiresAt).getTime() <= Date.now()
  ) {
    throw new DomainError(
      "reservation_expired",
      409,
      "O prazo desta reserva terminou. Escolha o horário novamente.",
    );
  }
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
  const existing = await client.get<SessionPaymentRow[]>(
    `/rest/v1/session_payments?select=id,stripe_checkout_session_id&booking_id=eq.${encodeURIComponent(
      input.booking.id,
    )}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const inserted = await client.post<SessionPaymentRow[]>(
    "/rest/v1/session_payments?select=id,stripe_checkout_session_id",
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

async function getSessionPayment(
  client: SupabaseRestClient,
  sessionPaymentId: string,
) {
  const rows = await client.get<SessionPaymentRow[]>(
    `/rest/v1/session_payments?select=id,stripe_checkout_session_id&id=eq.${encodeURIComponent(
      sessionPaymentId,
    )}&limit=1`,
  );
  return rows[0] ?? null;
}

async function validateReplacementCheckout(input: {
  booking: BookingRow;
  checkoutSessionId: string;
  customerId: string;
  environment: string;
  sessionPayment: SessionPaymentRow;
  stripe: ReturnType<typeof createStripeClient>;
  stripeMode: string;
}) {
  if (
    input.sessionPayment.stripe_checkout_session_id !== input.checkoutSessionId
  ) {
    throw new DomainError(
      "checkout_replacement_conflict",
      409,
      "O pagamento foi atualizado em outra tentativa. Recarregue para continuar.",
    );
  }

  const checkout = await input.stripe.checkout.sessions.retrieve(
    input.checkoutSessionId,
  );
  const checkoutCustomer =
    typeof checkout.customer === "string"
      ? checkout.customer
      : (checkout.customer?.id ?? null);

  if (
    checkout.status !== "open" ||
    checkout.mode !== "payment" ||
    checkout.livemode !== (input.stripeMode === "live") ||
    checkoutCustomer !== input.customerId ||
    checkout.client_reference_id !== input.booking.id ||
    checkout.metadata?.system !== "tes" ||
    checkout.metadata?.payment_type !== "therapy_session" ||
    checkout.metadata?.environment !== input.environment ||
    checkout.metadata?.stripe_mode !== input.stripeMode ||
    checkout.metadata?.tes_session_payment_id !== input.sessionPayment.id ||
    checkout.metadata?.tes_patient_id !== input.booking.patient_profile_id
  ) {
    throw new DomainError(
      "checkout_replacement_forbidden",
      409,
      "Este pagamento não pode mais ser atualizado.",
    );
  }

  return checkout;
}

async function markAttemptSuperseded(
  client: SupabaseRestClient,
  checkoutSessionId: string,
) {
  return updateAttemptStatus(client, checkoutSessionId, "superseded");
}

async function updateAttemptStatus(
  client: SupabaseRestClient,
  checkoutSessionId: string,
  status: string,
) {
  await client.patch(
    `/rest/v1/session_payment_attempts?stripe_checkout_session_id=eq.${encodeURIComponent(
      checkoutSessionId,
    )}`,
    { status },
    "return=minimal",
  );
}

async function restoreCurrentCheckout(input: {
  client: SupabaseRestClient;
  currentCheckoutId: string;
  previousCheckoutId: string;
  sessionPaymentId: string;
}) {
  await input.client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(
      input.sessionPaymentId,
    )}&stripe_checkout_session_id=eq.${encodeURIComponent(input.currentCheckoutId)}`,
    {
      stripe_checkout_session_id: input.previousCheckoutId,
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function expireCheckoutQuietly(
  stripe: ReturnType<typeof createStripeClient>,
  checkoutSessionId: string,
) {
  try {
    await stripe.checkout.sessions.expire(checkoutSessionId);
    return true;
  } catch {
    return false;
  }
}

export {};
