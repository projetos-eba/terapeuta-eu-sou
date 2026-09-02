import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";
import {
  type BookingCheckoutCommandBody,
  type ExistingCheckoutHold,
  mapBookingCheckoutDatabaseError,
  MAX_SHARED_NOTE_LENGTH,
  resolveExistingCheckoutHold,
  selectAvailableSlot,
  type ServiceAvailableSlotsResponse,
  slotRangeEnd,
  validateBookingCheckoutCommand,
} from "./booking-checkout-command.ts";
import type { PromotionSummary } from "../_shared/payments/promotion-codes.ts";

type BookingHoldRow = {
  expires_at: string;
  id: string;
};

type ExistingBookingHoldRow = {
  consumed_booking_id: string | null;
  ends_at: string;
  expires_at: string;
  id: string;
  patient_profile_id: string;
  service_id: string;
  starts_at: string;
  status: string;
  timezone: string;
};

type BookingRow = {
  id: string;
};

type ServiceIntakeContextRow = {
  description: string | null;
  id: string;
  therapist_profile_id: string;
};

type LegalAcceptanceRow = {
  document_key: string;
  document_version_id: string;
};

type LegalDocumentVersionRow = {
  document_key: string;
};

type CheckoutResponse = {
  ok: true;
  data: {
    clientSecret: string | null;
    checkoutSessionId: string;
    currency: string;
    discountAmountCents: number;
    originalAmountCents: number;
    promotion: PromotionSummary | null;
    sessionPaymentId: string;
    totalAmountCents: number;
    url: string | null;
  };
};

const runtime = getRuntime("session-booking-checkout");
const DEFAULT_SHARED_NOTE =
  "Você poderá complementar suas informações antes do encontro, se desejar.";

function toExistingCheckoutHold(
  row: ExistingBookingHoldRow | undefined,
): ExistingCheckoutHold | null {
  if (!row) return null;

  return {
    consumedBookingId: row.consumed_booking_id,
    endsAt: row.ends_at,
    expiresAt: row.expires_at,
    id: row.id,
    patientProfileId: row.patient_profile_id,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    status: row.status,
    timezone: row.timezone,
  };
}

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  let operation = "session_booking_checkout";

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const bearerToken = requireBearerToken(request);
    const { profile: patient } = await requirePatient(client, request);
    const command = validateBookingCheckoutCommand(
      await parseJsonBody<BookingCheckoutCommandBody>(request),
    );
    let bootstrapBookingId: string | null = null;
    let bootstrapHoldId: string | null = null;

    try {
      operation = "expire_due_initial_checkout_attempts_v1";
      await client.rpc(operation, {
        p_limit: 100,
        p_now: new Date().toISOString(),
      });
      operation = "expire_due_initial_checkout_orphans_v1";
      await client.rpc(operation, {
        p_limit: 100,
        p_now: new Date().toISOString(),
      });

      operation = "get_existing_booking_hold";
      const existingHolds = await client.get<ExistingBookingHoldRow[]>(
        `/rest/v1/booking_holds?select=id,expires_at,patient_profile_id,service_id,starts_at,ends_at,timezone,status,consumed_booking_id&idempotency_key=eq.${encodeURIComponent(
          command.requestId,
        )}&limit=1`,
      );
      const existingHold = resolveExistingCheckoutHold(
        toExistingCheckoutHold(existingHolds[0]),
        command,
        patient.id,
      );

      operation = "get_booking_intake_context";
      const serviceRows = await client.get<ServiceIntakeContextRow[]>(
        `/rest/v1/therapist_services?select=id,therapist_profile_id,description&id=eq.${encodeURIComponent(
          command.serviceId,
        )}&limit=1`,
      );
      const service = serviceRows[0];
      if (!service) {
        throw new DomainError(
          "service_not_found",
          404,
          "Não foi possível confirmar o serviço escolhido.",
        );
      }

      let hold: BookingHoldRow;
      let booking: BookingRow;
      let bookingWasJustConsumed = false;
      if (existingHold) {
        hold = {
          expires_at: existingHold.hold.expiresAt,
          id: existingHold.hold.id,
        };
        if (existingHold.bookingId) {
          booking = { id: existingHold.bookingId };
        } else {
          operation = "preflight_checkout_legal_documents";
          await assertCheckoutLegalDocumentsPublished(client);

          operation = "consume_booking_hold_v1";
          booking = await client.rpc<BookingRow>(operation, {
            p_hold_id: hold.id,
            p_idempotency_key: command.requestId,
          });
          bookingWasJustConsumed = true;
          bootstrapBookingId = booking.id;
          bootstrapHoldId = hold.id;
        }
      } else {
        operation = "preflight_checkout_legal_documents";
        await assertCheckoutLegalDocumentsPublished(client);

        operation = "get_service_available_slots_v1";
        const slots = await client.rpc<ServiceAvailableSlotsResponse | null>(
          operation,
          {
            p_limit: 50,
            p_range_end: slotRangeEnd(command.startsAt),
            p_range_start: command.startsAt,
            p_service_id: command.serviceId,
          },
        );
        const selectedSlot = selectAvailableSlot(slots, command.startsAt);

        operation = "reserve_booking_hold_v1";
        hold = await client.rpc<BookingHoldRow>(operation, {
          p_ends_at: selectedSlot.endsAt,
          p_idempotency_key: command.requestId,
          p_patient_profile_id: patient.id,
          p_service_id: command.serviceId,
          p_starts_at: selectedSlot.startsAt,
          p_timezone: selectedSlot.timezone,
          p_ttl_seconds: command.holdTtlSeconds,
        });

        operation = "consume_booking_hold_v1";
        booking = await client.rpc<BookingRow>(operation, {
          p_hold_id: hold.id,
          p_idempotency_key: command.requestId,
        });
        bookingWasJustConsumed = true;
        bootstrapBookingId = booking.id;
        bootstrapHoldId = hold.id;
      }

      if (bookingWasJustConsumed) {
        operation = "register_checkout_legal_acceptances";
        const legalAcceptances = await registerCheckoutLegalAcceptances({
          bookingId: booking.id,
          client,
          profileId: patient.user_id,
          requestId: command.requestId,
        });

        operation = "snapshot_booking_legal_versions";
        await snapshotBookingLegalVersions({
          bookingId: booking.id,
          client,
          legalAcceptances,
        });
      }

      operation = "save_booking_intake_response";
      await saveBookingIntakeResponse({
        bookingId: booking.id,
        client,
        patientProfileId: patient.id,
        sharedNote: command.sharedNote ?? DEFAULT_SHARED_NOTE,
        service,
      });

      operation = "stripe-create-session-payment";
      const checkout = await invokeSessionPaymentCheckout({
        bearerToken,
        bookingId: booking.id,
        bookingHoldId: hold.id,
        checkoutAttemptId: command.requestId,
        reservationExpiresAt: hold.expires_at,
        returnUrlBase: command.returnUrlBase,
        serviceRoleKey,
        supabaseUrl,
      });

      return success({
        bookingId: booking.id,
        clientSecret: checkout.data.clientSecret,
        checkoutSessionId: checkout.data.checkoutSessionId,
        currency: checkout.data.currency,
        discountAmountCents: checkout.data.discountAmountCents,
        holdExpiresAt: hold.expires_at,
        holdId: hold.id,
        mode: "initial_hold",
        originalAmountCents: checkout.data.originalAmountCents,
        promotion: checkout.data.promotion,
        sessionPaymentId: checkout.data.sessionPaymentId,
        totalAmountCents: checkout.data.totalAmountCents,
        url: checkout.data.url,
        reservationExpiresAt: hold.expires_at,
        serverNow: new Date().toISOString(),
      });
    } catch (error) {
      if (bootstrapBookingId && bootstrapHoldId) {
        try {
          await client.rpc("cancel_unstarted_initial_checkout_v1", {
            p_booking_id: bootstrapBookingId,
            p_hold_id: bootstrapHoldId,
            p_reason: "checkout_bootstrap_failed",
          });
        } catch {
          console.warn(
            JSON.stringify({
              code: "INITIAL_CHECKOUT_BOOTSTRAP_COMPENSATION_DEFERRED",
              correlation_id: correlationId,
            }),
          );
        }
      }
      throw mapBookingCheckoutDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "patient",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code:
          error instanceof DomainError
            ? error.code
            : "session_booking_checkout_failed",
        operation,
      }),
    );
    return failure(error, correlationId);
  }
});

async function assertCheckoutLegalDocumentsPublished(
  client: SupabaseRestClient,
) {
  const documentKeys = [
    "terms-of-use",
    "privacy-policy",
    "cancellation-reschedule-refund-policy",
  ];
  const effectiveAt = encodeURIComponent(new Date().toISOString());
  const rows = await client.get<LegalDocumentVersionRow[]>(
    `/rest/v1/legal_document_versions?select=document_key&document_key=in.(${documentKeys.join(
      ",",
    )})&status=eq.published&effective_at=lte.${effectiveAt}`,
  );
  const publishedKeys = new Set(rows.map((row) => row.document_key));
  const hasAllDocuments = documentKeys.every((key) => publishedKeys.has(key));

  if (!hasAllDocuments) {
    throw new DomainError(
      "legal_document_not_published",
      428,
      "Os documentos juridicos aplicaveis ainda nao estao publicados.",
    );
  }
}

async function saveBookingIntakeResponse(input: {
  bookingId: string;
  client: SupabaseRestClient;
  patientProfileId: string;
  service: ServiceIntakeContextRow;
  sharedNote: string;
}) {
  if (input.sharedNote.length > MAX_SHARED_NOTE_LENGTH) {
    throw new DomainError(
      "invalid_booking_checkout_payload",
      422,
      "Revise os dados compartilhados antes de continuar.",
    );
  }

  await input.client.post(
    "/rest/v1/booking_intake_responses?on_conflict=booking_id",
    {
      booking_id: input.bookingId,
      focus_area: "Seu momento atual",
      patient_profile_id: input.patientProfileId,
      shared_note: input.sharedNote,
      therapist_profile_id: input.service.therapist_profile_id,
      therapy_goal:
        input.service.description?.trim() ||
        "Acompanhar sua jornada com presença e cuidado.",
      visibility: "patient_therapist",
    },
    "resolution=merge-duplicates,return=minimal",
  );
}

async function registerCheckoutLegalAcceptances(input: {
  bookingId: string;
  client: SupabaseRestClient;
  profileId: string;
  requestId: string;
}) {
  const evidence = {
    source: "session_booking_checkout",
    userAgent: "not_stored",
  };
  const acceptances: LegalAcceptanceRow[] = [];

  for (const documentKey of [
    "terms-of-use",
    "privacy-policy",
    "cancellation-reschedule-refund-policy",
  ]) {
    const acceptance = await input.client.rpc<LegalAcceptanceRow>(
      "register_legal_acceptance_v1",
      {
        p_actor_role: "patient",
        p_booking_id: input.bookingId,
        p_context: "reservation_checkout",
        p_document_key: documentKey,
        p_evidence: evidence,
        p_profile_id: input.profileId,
        p_request_id: input.requestId,
      },
    );

    acceptances.push(acceptance);
  }

  return acceptances;
}

async function snapshotBookingLegalVersions(input: {
  bookingId: string;
  client: SupabaseRestClient;
  legalAcceptances: LegalAcceptanceRow[];
}) {
  const versionByKey = new Map(
    input.legalAcceptances.map((acceptance) => [
      acceptance.document_key,
      acceptance.document_version_id,
    ]),
  );

  await input.client.patch(
    `/rest/v1/bookings?id=eq.${input.bookingId}`,
    {
      legal_acceptance_recorded_at: new Date().toISOString(),
      legal_cancellation_policy_version_id: versionByKey.get(
        "cancellation-reschedule-refund-policy",
      ),
      legal_privacy_version_id: versionByKey.get("privacy-policy"),
      legal_terms_version_id: versionByKey.get("terms-of-use"),
    },
    "return=minimal",
  );
}

async function invokeSessionPaymentCheckout(input: {
  bearerToken: string;
  bookingId: string;
  bookingHoldId: string;
  checkoutAttemptId: string;
  reservationExpiresAt: string;
  returnUrlBase: string | null;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(
        `${input.supabaseUrl}/functions/v1/stripe-create-session-payment`,
        {
          body: JSON.stringify({
            bookingId: input.bookingId,
            bookingHoldId: input.bookingHoldId,
            checkoutAttemptId: input.checkoutAttemptId,
            checkoutUiMode: "embedded",
            attemptKind: "initial_hold",
            reservationExpiresAt: input.reservationExpiresAt,
            returnUrlBase: input.returnUrlBase,
          }),
          headers: {
            apikey: input.serviceRoleKey,
            Authorization: `Bearer ${input.bearerToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | CheckoutResponse
        | {
            ok: false;
            error?: { code?: string; message?: string };
          }
        | null;

      if (response.ok && payload?.ok === true) return payload;

      const transient = response.status === 429 || response.status >= 500;
      if (attempt === 0 && (transient || payload === null)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      throw new DomainError(
        payload?.ok === false && payload.error?.code
          ? payload.error.code
          : "session_payment_checkout_failed",
        response.status || 502,
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Nao conseguimos iniciar o pagamento agora.",
      );
    } catch (error) {
      if (attempt === 0 && !(error instanceof DomainError)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      throw error;
    }
  }

  throw new DomainError(
    "session_payment_checkout_failed",
    502,
    "Nao conseguimos iniciar o pagamento agora.",
  );
}

function requireBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new DomainError(
      "unauthorized",
      401,
      "Entre na sua conta para continuar.",
    );
  }

  return token;
}

export {};
