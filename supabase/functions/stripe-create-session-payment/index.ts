import { handleOptions } from "../_shared/auth/cors.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
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
  calculateSessionPromotionAmounts,
  getSessionChargeTiming,
  SESSION_FINANCIAL_CONSENT_V10,
  SESSION_FINANCIAL_FLOW_V10,
  SESSION_FINANCIAL_POLICY_V10,
  type SessionChargeTiming,
} from "../_shared/payments/session-financial-flow-v10.ts";
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
  gross_amount_cents: number;
  id: string;
  metadata: Record<string, unknown> | null;
  payment_due_at: string | null;
  payment_flow_version: string;
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
  version: number;
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

    const customer = await getOrCreatePatientCustomer({
      client,
      environment: config.environment,
      patient,
      stripe,
      userId: user.id,
    });
    const existingPayment = await getSessionPaymentByBooking(
      client,
      booking.id,
    );
    const useV10 =
      existingPayment?.payment_flow_version === SESSION_FINANCIAL_FLOW_V10 ||
      (!existingPayment && config.sessionFinancialFlowV10Enabled);
    const policy = useV10 ? null : await getActivePolicy(client);
    const snapshot = calculateCommissionSnapshot({
      grossAmountCents: booking.service_price_cents_snapshot,
      platformCommissionBps: policy?.platform_commission_bps ?? 1500,
    });
    const preparedV10 = useV10
      ? await prepareSessionPaymentV10AfterOptionalRetry(client, {
          bookingId: booking.id,
          mode,
          originalAmountCents: booking.service_price_cents_snapshot,
          stripeCustomerRecordId: customer.id,
        })
      : null;
    const sessionPayment =
      existingPayment ??
      (preparedV10
        ? preparedV10.payment
        : await createSessionPaymentV9(client, {
            booking,
            customerId: customer.id,
            policyId: policy!.id,
            snapshot,
          }));
    const checkoutBookingVersion =
      preparedV10?.bookingVersion ?? booking.version;
    const paymentFlowVersion = sessionPayment.payment_flow_version;
    const isV10 = paymentFlowVersion === SESSION_FINANCIAL_FLOW_V10;
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
            expectedMode: undefined,
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
    const v10Amounts = isV10
      ? calculateSessionPromotionAmounts({
          originalAmountCents: snapshot.grossAmountCents,
          promotion: promotion?.summary ?? null,
        })
      : null;
    const paymentTiming: SessionChargeTiming = isV10
      ? getSessionChargeTiming(booking.starts_at)
      : "immediate";
    const stripeCheckoutMode =
      isV10 &&
      paymentTiming === "scheduled" &&
      (v10Amounts?.chargedAmountCents ?? 0) > 0
        ? "setup"
        : "payment";
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "session_payment_v2",
      checkoutUiMode,
      paymentFlowVersion,
      stripeCheckoutMode,
      mode,
      booking.id,
      checkoutBookingVersion,
      sessionPayment.id,
      checkoutAttemptId,
      promotion?.promotionCodeId ?? "no_promotion",
    ]);
    if (
      isV10 &&
      sessionPayment.stripe_checkout_session_id &&
      !replaceCheckoutSessionId
    ) {
      const attempts = await client.get<
        Array<{
          stripe_checkout_session_id: string | null;
        }>
      >(
        `/rest/v1/session_payment_attempts?select=stripe_checkout_session_id&idempotency_key=eq.${encodeURIComponent(
          idempotencyKey,
        )}&limit=1`,
      );
      if (
        attempts[0]?.stripe_checkout_session_id !==
        sessionPayment.stripe_checkout_session_id
      ) {
        throw new DomainError(
          "checkout_replacement_required",
          409,
          "Este pagamento já está aberto. Atualize a página para continuar.",
        );
      }
    }
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
        expectedMode: stripeCheckoutMode,
      });
      const retriedAmounts =
        stripeCheckoutMode === "setup"
          ? getSessionPaymentFinancials(
              sessionPayment,
              snapshot.grossAmountCents,
            )
          : checkoutAmounts(retriedCheckout);
      return success({
        bookingId: booking.id,
        clientSecret: retriedCheckout.client_secret ?? null,
        checkoutSessionId: retriedCheckout.id,
        ...retriedAmounts,
        mode,
        paymentFlowVersion,
        paymentTiming,
        promotion: promotion?.summary ?? null,
        reservationExpiresAt:
          mode === "initial_hold" ? reservationExpiresAt : null,
        serverNow: new Date().toISOString(),
        sessionPaymentId: sessionPayment.id,
        url: retriedCheckout.url,
      });
    }
    const commonMetadata = {
      environment: config.environment,
      payment_type: "therapy_session",
      stripe_mode: config.stripeMode,
      system: "tes",
      tes_booking_version: String(checkoutBookingVersion),
      tes_checkout_mode: mode,
      tes_charge_timing: paymentTiming,
      tes_consent_version: SESSION_FINANCIAL_CONSENT_V10,
      tes_patient_id: patient.id,
      tes_payment_flow_version: paymentFlowVersion,
      tes_policy_key: isV10 ? SESSION_FINANCIAL_POLICY_V10 : "v9",
      tes_session_id: booking.id,
      tes_session_payment_id: sessionPayment.id,
      tes_therapist_id: booking.therapist_profile_id,
      ...(promotion
        ? { tes_promotion_code_id: promotion.promotionCodeId }
        : {}),
    };
    const commonCheckoutParams = {
      client_reference_id: booking.id,
      customer: customer.stripe_customer_id,
      integration_identifier: integrationIdentifier,
      locale: "pt-BR" as const,
      metadata: commonMetadata,
      return_url: `${checkoutReturnUrlBase}/reserva/sucesso?booking=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      ui_mode: "embedded_page" as const,
    };
    const checkoutSessionParams =
      stripeCheckoutMode === "setup"
        ? {
            ...commonCheckoutParams,
            mode: "setup" as const,
            payment_method_types: ["card" as const],
            setup_intent_data: {
              metadata: commonMetadata,
            },
          }
        : {
            ...commonCheckoutParams,
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
            ...(promotion
              ? { discounts: [{ promotion_code: promotion.promotionCodeId }] }
              : {}),
            mode: "payment" as const,
            payment_intent_data: {
              ...(isV10 ? {} : { capture_method: "manual" as const }),
              metadata: commonMetadata,
              transfer_group: `tes_booking_${booking.id}`,
            },
          };
    let checkout: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      checkout = await stripe.checkout.sessions.create(checkoutSessionParams, {
        idempotencyKey,
      });
    } catch (error) {
      throw mapPromotionStripeError(error) ?? error;
    }

    const amounts =
      stripeCheckoutMode === "setup"
        ? {
            currency: booking.currency_snapshot.toUpperCase(),
            discountAmountCents: v10Amounts!.discountAmountCents,
            originalAmountCents: v10Amounts!.originalAmountCents,
            totalAmountCents: v10Amounts!.chargedAmountCents,
          }
        : checkoutAmounts(checkout);
    // Stripe supports no-cost one-time Checkout Sessions. Keep the session
    // open so Embedded Checkout can confirm the free booking and emit the
    // signed checkout.session.completed webhook. The webhook remains the
    // only authority that marks session_payments/bookings as paid.

    const compareCheckoutId =
      replaceCheckoutSessionId ?? sessionPayment.stripe_checkout_session_id;
    if (isV10 && previousCheckout && previousCheckout.id !== checkout.id) {
      const expired = await expireCheckoutQuietly(stripe, previousCheckout.id);
      if (!expired) {
        await expireCheckoutQuietly(stripe, checkout.id);
        throw new DomainError(
          "checkout_replacement_conflict",
          409,
          "Não foi possível atualizar o pagamento. Tente novamente.",
        );
      }
    }
    let updatedPayments: { applied?: boolean } | SessionPaymentRow[];
    try {
      updatedPayments = isV10
        ? await swapSessionPaymentCheckoutV10(client, {
            amounts,
            bookingVersion: checkoutBookingVersion,
            checkoutSessionId: checkout.id,
            expectedCheckoutSessionId: compareCheckoutId,
            idempotencyKey,
            paymentTiming,
            promotion: promotion?.summary ?? null,
            sessionPaymentId: sessionPayment.id,
            stripeEnvironment: config.environment,
          })
        : await client.patch<SessionPaymentRow[]>(
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
    } catch (error) {
      await expireCheckoutQuietly(stripe, checkout.id);
      throw error;
    }
    const didSwapCheckout = isV10
      ? Boolean((updatedPayments as { applied?: boolean })?.applied)
      : Boolean((updatedPayments as SessionPaymentRow[])[0]);
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
          payment_flow_version: paymentFlowVersion,
          payment_timing: paymentTiming,
          stripe_checkout_mode: stripeCheckoutMode,
          has_promotion: Boolean(promotion),
          replaces_checkout_session_id: replaceCheckoutSessionId,
        },
        response_metadata: amounts,
      },
      "resolution=merge-duplicates,return=minimal",
    );

    if (previousCheckout && didSwapCheckout && isV10) {
      await markAttemptSuperseded(client, previousCheckout.id);
    } else if (previousCheckout && didSwapCheckout) {
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
      paymentFlowVersion,
      paymentTiming,
      promotion: promotion?.summary ?? null,
      reservationExpiresAt:
        mode === "initial_hold" ? reservationExpiresAt : null,
      serverNow: new Date().toISOString(),
      sessionPaymentId: sessionPayment.id,
      url: checkout.url,
    });
  } catch (error) {
    if (error instanceof SupabaseHttpError) {
      let dbCode = "unknown";
      let reason = "redacted";
      try {
        const details = JSON.parse(error.safeDetails ?? "{}") as {
          code?: unknown;
          message?: unknown;
        };
        if (
          typeof details.code === "string" &&
          /^[A-Z0-9]{5}$/.test(details.code)
        ) {
          dbCode = details.code;
        }
        if (
          typeof details.message === "string" &&
          /^[A-Z][A-Z0-9_]{2,100}$/.test(details.message)
        ) {
          reason = details.message;
        }
      } catch {
        // Never log a raw database response or financial identifiers.
      }
      console.error(
        JSON.stringify({
          code: "SESSION_CHECKOUT_DATABASE_FAILURE",
          dbCode,
          reason,
          status: error.status,
          requestId,
        }),
      );
    }
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
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,status,starts_at,version,service_title_snapshot,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot,therapist_profiles(status,is_accepting_bookings)&id=eq.${encodeURIComponent(
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

async function getSessionPaymentByBooking(
  client: SupabaseRestClient,
  bookingId: string,
) {
  const rows = await client.get<SessionPaymentRow[]>(
    `/rest/v1/session_payments?select=id,stripe_checkout_session_id,payment_flow_version,payment_due_at,gross_amount_cents,metadata&booking_id=eq.${encodeURIComponent(
      bookingId,
    )}&limit=1`,
  );
  return rows[0] ?? null;
}

async function createSessionPaymentV9(
  client: SupabaseRestClient,
  input: {
    booking: BookingRow;
    customerId: string;
    policyId: string;
    snapshot: ReturnType<typeof calculateCommissionSnapshot>;
  },
) {
  const inserted = await client.post<SessionPaymentRow[]>(
    "/rest/v1/session_payments?select=id,stripe_checkout_session_id,payment_flow_version,payment_due_at,gross_amount_cents,metadata",
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

async function prepareSessionPaymentV10(
  client: SupabaseRestClient,
  input: {
    bookingId: string;
    originalAmountCents: number;
    stripeCustomerRecordId: string;
  },
) {
  const prepared = await client.rpc<{
    bookingVersion: number;
    paymentDueAt: string;
    paymentFlowVersion: string;
    sessionPaymentId: string;
    stripeCheckoutSessionId: string | null;
  }>("prepare_session_payment_v10", {
    p_booking_id: input.bookingId,
    p_stripe_customer_id: input.stripeCustomerRecordId,
  });

  return {
    bookingVersion: prepared.bookingVersion,
    payment: {
      gross_amount_cents: input.originalAmountCents,
      id: prepared.sessionPaymentId,
      metadata: null,
      payment_due_at: prepared.paymentDueAt,
      payment_flow_version: prepared.paymentFlowVersion,
      stripe_checkout_session_id: prepared.stripeCheckoutSessionId,
    } satisfies SessionPaymentRow,
  };
}

async function prepareSessionPaymentV10AfterOptionalRetry(
  client: SupabaseRestClient,
  input: {
    bookingId: string;
    mode: ReservationCheckoutMode;
    originalAmountCents: number;
    stripeCustomerRecordId: string;
  },
) {
  if (input.mode === "payment_retry") {
    const retry = await client.rpc<{ allowed?: boolean; reason?: string }>(
      "begin_session_payment_retry_v10",
      { p_booking_id: input.bookingId },
    );
    if (!retry.allowed) {
      throw new DomainError(
        retry.reason === "patient_schedule_conflict"
          ? "patient_schedule_conflict"
          : retry.reason === "slot_conflict"
            ? "slot_not_available"
            : "booking_not_payable",
        409,
        "Este pagamento não pode ser retomado agora.",
      );
    }
  }
  return prepareSessionPaymentV10(client, input);
}

function getSessionPaymentFinancials(
  payment: SessionPaymentRow,
  fallbackOriginalAmountCents: number,
) {
  const checkout = payment.metadata?.stripe_checkout;
  const snapshot =
    checkout && typeof checkout === "object" && !Array.isArray(checkout)
      ? (checkout as Record<string, unknown>)
      : {};
  const originalAmountCents = Number.isInteger(snapshot.original_amount_cents)
    ? (snapshot.original_amount_cents as number)
    : fallbackOriginalAmountCents;
  const chargedAmountCents = Number.isInteger(snapshot.charged_amount_cents)
    ? (snapshot.charged_amount_cents as number)
    : payment.gross_amount_cents;
  const discountAmountCents = Number.isInteger(snapshot.discount_amount_cents)
    ? (snapshot.discount_amount_cents as number)
    : Math.max(originalAmountCents - chargedAmountCents, 0);

  return {
    currency: "BRL",
    discountAmountCents,
    originalAmountCents,
    totalAmountCents: chargedAmountCents,
  };
}

async function swapSessionPaymentCheckoutV10(
  client: SupabaseRestClient,
  input: {
    amounts: {
      discountAmountCents: number;
      originalAmountCents: number;
      totalAmountCents: number;
    };
    bookingVersion: number;
    checkoutSessionId: string;
    expectedCheckoutSessionId: string | null;
    idempotencyKey: string;
    paymentTiming: SessionChargeTiming;
    promotion: PromotionSummary | null;
    sessionPaymentId: string;
    stripeEnvironment: string;
  },
) {
  return await client.rpc<{ applied?: boolean }>(
    "swap_session_payment_checkout_v10",
    {
      p_booking_version: input.bookingVersion,
      p_checkout_timing: input.paymentTiming,
      p_discount_amount_cents: input.amounts.discountAmountCents,
      p_discount_type:
        input.promotion?.amountOffCents !== undefined
          ? "fixed_amount"
          : input.promotion?.percentOff !== undefined
            ? "percent"
            : null,
      p_discount_value:
        input.promotion?.amountOffCents ??
        (input.promotion?.percentOff !== undefined
          ? Math.round(input.promotion.percentOff * 100)
          : null),
      p_expected_checkout_session_id: input.expectedCheckoutSessionId,
      p_idempotency_key: input.promotion ? input.idempotencyKey : null,
      p_new_checkout_session_id: input.checkoutSessionId,
      p_original_amount_cents: input.amounts.originalAmountCents,
      p_promotion_code: input.promotion?.code ?? null,
      p_session_payment_id: input.sessionPaymentId,
      p_stripe_coupon_id: input.promotion?.couponId ?? null,
      p_stripe_environment: input.stripeEnvironment,
      p_stripe_promotion_code_id: input.promotion?.promotionCodeId ?? null,
      p_total_amount_cents: input.amounts.totalAmountCents,
    },
  );
}

async function getSessionPayment(
  client: SupabaseRestClient,
  sessionPaymentId: string,
) {
  const rows = await client.get<SessionPaymentRow[]>(
    `/rest/v1/session_payments?select=id,stripe_checkout_session_id,payment_flow_version,payment_due_at,gross_amount_cents,metadata&id=eq.${encodeURIComponent(
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
  expectedMode: "payment" | "setup" | undefined;
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
    (input.expectedMode !== undefined &&
      checkout.mode !== input.expectedMode) ||
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
