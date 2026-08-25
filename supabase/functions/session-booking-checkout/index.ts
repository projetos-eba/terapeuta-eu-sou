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
  mapBookingCheckoutDatabaseError,
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

type BookingRow = {
  id: string;
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

    try {
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
      const hold = await client.rpc<BookingHoldRow>(operation, {
        p_ends_at: selectedSlot.endsAt,
        p_idempotency_key: command.requestId,
        p_patient_profile_id: patient.id,
        p_service_id: command.serviceId,
        p_starts_at: selectedSlot.startsAt,
        p_timezone: selectedSlot.timezone,
        p_ttl_seconds: command.holdTtlSeconds,
      });

      operation = "consume_booking_hold_v1";
      const booking = await client.rpc<BookingRow>(operation, {
        p_hold_id: hold.id,
        p_idempotency_key: command.requestId,
      });

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

      operation = "stripe-create-session-payment";
      const checkout = await invokeSessionPaymentCheckout({
        bearerToken,
        bookingId: booking.id,
        checkoutAttemptId: command.requestId,
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
        originalAmountCents: checkout.data.originalAmountCents,
        promotion: checkout.data.promotion,
        sessionPaymentId: checkout.data.sessionPaymentId,
        totalAmountCents: checkout.data.totalAmountCents,
        url: checkout.data.url,
      });
    } catch (error) {
      throw mapBookingCheckoutDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "patient",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code: error instanceof DomainError
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
    `/rest/v1/legal_document_versions?select=document_key&document_key=in.(${
      documentKeys.join(",")
    })&status=eq.published&effective_at=lte.${effectiveAt}`,
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

  for (
    const documentKey of [
      "terms-of-use",
      "privacy-policy",
      "cancellation-reschedule-refund-policy",
    ]
  ) {
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
  checkoutAttemptId: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  const response = await fetch(
    `${input.supabaseUrl}/functions/v1/stripe-create-session-payment`,
    {
      body: JSON.stringify({
        bookingId: input.bookingId,
        checkoutAttemptId: input.checkoutAttemptId,
        checkoutUiMode: "embedded",
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

  if (!response.ok || payload?.ok !== true) {
    throw new DomainError(
      payload?.ok === false && payload.error?.code
        ? payload.error.code
        : "session_payment_checkout_failed",
      response.status || 502,
      payload?.ok === false && payload.error?.message
        ? payload.error.message
        : "Nao conseguimos iniciar o pagamento agora.",
    );
  }

  return payload;
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
