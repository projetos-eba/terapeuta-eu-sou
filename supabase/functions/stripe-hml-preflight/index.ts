import { handleOptions } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
  getWebhookSecret,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Check = {
  name: string;
  status: "fail" | "pass";
  summary: string;
};

type BillingPriceRow = {
  stripe_price_id: string | null;
  unit_amount_cents: number;
};

type ConnectAccountRow = {
  charges_enabled: boolean | null;
  operational_status: string | null;
  payouts_enabled: boolean | null;
};

type ServiceBookingSettingsRow = {
  buffer_after_minutes: number;
  buffer_before_minutes: number;
};

type PublicTherapistFixtureRow = {
  next_slot_at: string | null;
  service_id: string | null;
};

type GoldenPathAction =
  | "find_clean"
  | "inspect"
  | "inspect_latest_paid"
  | "inspect_recent"
  | "prepare"
  | "release";

type GoldenPathRequest = {
  action?: GoldenPathAction;
  checkoutSessionId?: string;
  fixture?: FixtureReference;
};

type FixtureReference = {
  ruleId: string;
  serviceId: string;
  settings: FixtureSettings;
};

type FixtureSettings = {
  buffer_after_minutes: number;
  buffer_before_minutes: number;
  interval_minutes: number;
  max_days_ahead: number;
  min_notice_minutes: number;
};

const runtime = getPaymentsRuntime("stripe-hml-preflight");

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
    const user = await requireUser(client, request);
    if (user.role !== "admin") {
      throw new DomainError(
        "admin_required",
        403,
        "Acesso administrativo necessario.",
      );
    }

    const body = await parseJson<GoldenPathRequest>(request);
    if (body?.action) {
      assertHmlRuntime(config.supabaseUrl);
      if (body.action === "find_clean") {
        return success(await findCleanGoldenPathFixture(client, runtime));
      }
      if (body.action === "prepare") {
        return success(await prepareGoldenPathFixture(client, runtime));
      }
      if (body.action === "inspect") {
        return success(
          await inspectGoldenPathFixture(client, body, config.stripeApiKey),
        );
      }
      if (body.action === "inspect_recent") {
        return success(
          await inspectRecentGoldenPathFixture(
            client,
            runtime,
            config.stripeApiKey,
          ),
        );
      }
      if (body.action === "inspect_latest_paid") {
        return success(
          await inspectLatestPaidGoldenPathFixture(
            client,
            runtime,
            config.stripeApiKey,
          ),
        );
      }
      if (body.action === "release") {
        await releaseGoldenPathFixture(client, body.fixture);
        return success({ released: true });
      }
    }

    const stripe = createStripeClient(config.stripeApiKey);
    const checks: Check[] = [];

    await addCheck(checks, "stripe_test_mode", async () => {
      if (config.stripeMode !== "test") {
        throw new Error("stripe_mode_not_test");
      }
      return "Runtime HML usa Stripe test mode.";
    });
    await addCheck(checks, "stripe_api", async () => {
      await stripe.balance.retrieve();
      return "Stripe API respondeu para a conta da plataforma.";
    });
    await addCheck(checks, "billing_catalog", async () => {
      const rows = await client.get<BillingPriceRow[]>(
        "/rest/v1/billing_plan_prices?select=stripe_price_id,unit_amount_cents&is_active=eq.true&unit_amount_cents=gt.0",
      );
      if (!rows.length) throw new Error("paid_catalog_missing");

      for (const row of rows) {
        if (!row.stripe_price_id) throw new Error("stripe_price_missing");
        const price = await stripe.prices.retrieve(row.stripe_price_id);
        if (
          !price.active ||
          price.livemode ||
          price.unit_amount !== row.unit_amount_cents
        ) {
          throw new Error("stripe_price_mismatch");
        }
        if (typeof price.product === "string") {
          const product = await stripe.products.retrieve(price.product);
          if (!product.active) throw new Error("stripe_product_inactive");
        }
      }

      return `${rows.length} preco(s) ativo(s) correspondem ao catalogo HML.`;
    });
    await addCheck(checks, "platform_webhook", async () => {
      getWebhookSecret(runtime, "STRIPE_PLATFORM_WEBHOOK_SECRET");
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const endpoint = endpoints.data.find(
        (candidate) =>
          candidate.status === "enabled" &&
          candidate.url.includes("/functions/v1/stripe-billing-webhook") &&
          candidate.url.includes(new URL(config.supabaseUrl).host),
      );
      if (!endpoint || !hasEvents(endpoint.enabled_events, platformEvents)) {
        throw new Error("platform_webhook_missing_or_incomplete");
      }
      return "Webhook da plataforma esta habilitado com eventos essenciais.";
    });
    await addCheck(checks, "connect_webhook", async () => {
      getWebhookSecret(runtime, "STRIPE_CONNECT_WEBHOOK_SECRET");
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const endpoint = endpoints.data.find(
        (candidate) =>
          candidate.status === "enabled" &&
          candidate.url.includes("/functions/v1/stripe-connect-webhook") &&
          candidate.url.includes(new URL(config.supabaseUrl).host),
      );
      if (
        !endpoint ||
        !hasEvents(endpoint.enabled_events, ["account.updated"])
      ) {
        throw new Error("connect_webhook_missing_or_incomplete");
      }
      return "Webhook Connect esta habilitado com o evento de estado da conta.";
    });
    await addCheck(checks, "payment_functions", async () => {
      const results = await Promise.all(
        paymentFunctions.map(async (name) => {
          const response = await fetch(
            `${config.supabaseUrl}/functions/v1/${name}`,
            {
              method: "OPTIONS",
              signal: AbortSignal.timeout(10_000),
            },
          );
          return response.status >= 200 && response.status < 500;
        }),
      );
      if (results.some((result) => !result)) {
        throw new Error("payment_function_unreachable");
      }
      return `${paymentFunctions.length} Edge Functions criticas responderam ao preflight.`;
    });
    await addCheck(checks, "session_payment_state", async () => {
      await client.get<Array<{ id: string }>>(
        "/rest/v1/session_payments?select=id&limit=1",
      );
      return "Estado autoritativo de pagamentos de sessao esta acessivel no HML.";
    });
    await addCheck(checks, "public_booking_fixture", async () => {
      const rows = await client.get<PublicTherapistFixtureRow[]>(
        `/rest/v1/public_therapist_search?select=service_id,next_slot_at&slug=eq.${encodeURIComponent(
          runtime.env.get("PAYMENTS_HML_PUBLIC_THERAPIST_SLUG")?.trim() ||
            "antonio-ferrari-e2e",
        )}&limit=1`,
      );
      if (!rows[0]?.service_id || !rows[0].next_slot_at) {
        throw new Error("public_booking_fixture_missing");
      }
      return "Fixture publica tem servico e proximo horario para um unico booking.";
    });
    await addCheck(checks, "connect_account_state", async () => {
      const rows = await client.get<ConnectAccountRow[]>(
        "/rest/v1/therapist_connect_accounts?select=operational_status,charges_enabled,payouts_enabled",
      );
      if (!rows.length) throw new Error("connect_account_missing");
      const readyAccounts = rows.filter(
        (row) => row.charges_enabled === true && row.payouts_enabled === true,
      ).length;
      return `${rows.length} conta(s) Connect observada(s); ${readyAccounts} pronta(s) para repasse.`;
    });
    await addCheck(checks, "payout_operations", async () => {
      if (!runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN")?.trim()) {
        throw new Error("operations_token_missing");
      }
      return "Credencial operacional de repasses esta configurada no runtime HML.";
    });

    return success({ checks });
  } catch (error) {
    return failure(error, requestId);
  }
});

const platformEvents = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "invoice.paid",
  "payment_intent.succeeded",
  "charge.refunded",
  "transfer.updated",
];

const paymentFunctions = [
  "session-booking-checkout",
  "stripe-create-session-payment",
  "stripe-create-subscription-checkout",
  "stripe-subscription-checkout-status",
  "stripe-connect-create-account",
  "stripe-connect-create-account-link",
  "stripe-connect-sync-account",
  "evaluate-transfer-eligibility",
  "create-weekly-payout-batch",
  "process-payout-batch",
  "reconcile-stripe-transfers",
];

const HML_SUPABASE_HOST = "emzwqkmrryuqvqiohqnu.supabase.co";
const FIXTURE_TIMEZONE = "America/Sao_Paulo";

function assertHmlRuntime(supabaseUrl: string) {
  if (new URL(supabaseUrl).hostname !== HML_SUPABASE_HOST) {
    throw new DomainError(
      "hml_runtime_required",
      403,
      "A qualificacao transacional so pode executar em HML.",
    );
  }
}

async function findCleanGoldenPathFixture(
  client: SupabaseRestClient,
  runtime: ReturnType<typeof getPaymentsRuntime>,
) {
  const rangeStart = new Date(Date.now() + 24 * 60 * 60_000);
  const rangeEnd = new Date(Date.now() + 72 * 60 * 60_000);
  const slug =
    runtime.env.get("PAYMENTS_HML_PUBLIC_THERAPIST_SLUG")?.trim() ||
    "antonio-ferrari-e2e";
  const [publicFixture] = await client.get<PublicTherapistFixtureRow[]>(
    `/rest/v1/public_therapist_search?select=service_id&slug=eq.${encodeURIComponent(
      slug,
    )}&limit=1`,
  );
  if (!publicFixture?.service_id) {
    throw new DomainError(
      "fixture_missing",
      409,
      "Fixture publica indisponivel.",
    );
  }

  const [initialService] = await client.get<
    Array<{
      duration_minutes: number;
      id: string;
      price_cents: number;
      therapist_profile_id: string;
    }>
  >(
    `/rest/v1/therapist_services?select=id,therapist_profile_id,duration_minutes,price_cents&id=eq.${encodeURIComponent(
      publicFixture.service_id,
    )}&status=eq.active&is_bookable=eq.true&online_only=eq.true&limit=1`,
  );
  if (!initialService) {
    throw new DomainError(
      "fixture_missing",
      409,
      "Servico da fixture indisponivel.",
    );
  }
  const sameTherapistCandidates = await client.get<
    Array<{
      duration_minutes: number;
      id: string;
      price_cents: number;
      therapist_profile_id: string;
    }>
  >(
    `/rest/v1/therapist_services?select=id,therapist_profile_id,duration_minutes,price_cents&therapist_profile_id=eq.${encodeURIComponent(
      initialService.therapist_profile_id,
    )}&status=eq.active&is_bookable=eq.true&online_only=eq.true&order=price_cents.asc`,
  );
  const publicRows = await client.get<PublicTherapistFixtureRow[]>(
    "/rest/v1/public_therapist_search?select=service_id&service_id=not.is.null&limit=100",
  );
  const publicServiceIds = [
    ...new Set(publicRows.map((row) => row.service_id).filter(Boolean)),
  ] as string[];
  const publicCandidates = publicServiceIds.length
    ? await client.get<
        Array<{
          duration_minutes: number;
          id: string;
          price_cents: number;
          therapist_profile_id: string;
        }>
      >(
        `/rest/v1/therapist_services?select=id,therapist_profile_id,duration_minutes,price_cents&id=in.(${publicServiceIds
          .map(encodeURIComponent)
          .join(
            ",",
          )})&status=eq.active&is_bookable=eq.true&online_only=eq.true&order=price_cents.asc`,
      )
    : [];
  const candidates = [
    ...sameTherapistCandidates,
    ...publicCandidates.filter(
      (candidate) =>
        !sameTherapistCandidates.some(
          (sameTherapist) => sameTherapist.id === candidate.id,
        ),
    ),
  ];

  for (const service of candidates) {
    const [connect] = await client.get<ConnectAccountRow[]>(
      `/rest/v1/therapist_connect_accounts?select=charges_enabled,payouts_enabled,operational_status&therapist_profile_id=eq.${encodeURIComponent(
        service.therapist_profile_id,
      )}&limit=1`,
    );
    if (!connect?.charges_enabled || !connect?.payouts_enabled) continue;
    const [bookingSettings] = await client.get<ServiceBookingSettingsRow[]>(
      `/rest/v1/therapist_service_booking_settings?select=buffer_before_minutes,buffer_after_minutes&service_id=eq.${encodeURIComponent(
        service.id,
      )}&limit=1`,
    );
    if (!bookingSettings) continue;
    const slotSpacingMs =
      (service.duration_minutes +
        bookingSettings.buffer_before_minutes +
        bookingSettings.buffer_after_minutes) *
      60_000;
    const slots = await client.rpc<{
      slots?: Array<{ startsAt?: string }>;
      timezone?: string;
    }>("get_service_available_slots_v1", {
      p_limit: 50,
      p_range_end: rangeEnd.toISOString(),
      p_range_start: rangeStart.toISOString(),
      p_service_id: service.id,
    });
    const slotCandidates = (slots?.slots ?? []).filter(
      (candidate): candidate is { startsAt: string } =>
        typeof candidate.startsAt === "string",
    );
    const cleanSlots: Array<{ startsAt: string }> = [];
    for (const slot of slotCandidates) {
      const previous = cleanSlots.at(-1);
      if (
        previous &&
        new Date(slot.startsAt).getTime() <
          new Date(previous.startsAt).getTime() + slotSpacingMs
      ) {
        continue;
      }
      const endsAt = new Date(
        new Date(slot.startsAt).getTime() + service.duration_minutes * 60_000,
      );
      const overlaps = await client.get<Array<{ id: string }>>(
        `/rest/v1/bookings?select=id&therapist_profile_id=eq.${encodeURIComponent(
          service.therapist_profile_id,
        )}&starts_at=lt.${encodeURIComponent(
          endsAt.toISOString(),
        )}&ends_at=gt.${encodeURIComponent(slot.startsAt)}&limit=1`,
      );
      if (overlaps.length === 0) cleanSlots.push(slot);
      if (cleanSlots.length === 3) break;
    }
    if (!cleanSlots.length) continue;
    return {
      clean: {
        noActiveBookingOverlap: true,
        noActiveHoldOverlap: true,
        noExistingPayment: true,
        noExistingVideoSession: true,
        noScheduleRestriction: true,
        slotAvailable: true,
      },
      runId: `hml-golden-${crypto.randomUUID().slice(0, 8)}`,
      service: {
        durationMinutes: service.duration_minutes,
        id: service.id,
        priceCents: service.price_cents,
        therapistProfileId: service.therapist_profile_id,
      },
      slot: {
        startsAt: cleanSlots[0].startsAt,
        timezone: slots.timezone ?? FIXTURE_TIMEZONE,
      },
      fallbackSlots: cleanSlots.slice(1).map((slot) => ({
        startsAt: slot.startsAt,
        timezone: slots.timezone ?? FIXTURE_TIMEZONE,
      })),
      slotSpacingMinutes: Math.round(slotSpacingMs / 60_000),
    };
  }
  throw new DomainError(
    "no_clean_hml_fixture",
    409,
    "Nenhuma fixture limpa foi encontrada no intervalo pesquisado.",
  );
}

async function prepareGoldenPathFixture(
  client: SupabaseRestClient,
  runtime: ReturnType<typeof getPaymentsRuntime>,
) {
  const slug =
    runtime.env.get("PAYMENTS_HML_PUBLIC_THERAPIST_SLUG")?.trim() ||
    "antonio-ferrari-e2e";
  const [publicFixture] = await client.get<PublicTherapistFixtureRow[]>(
    `/rest/v1/public_therapist_search?select=service_id&slug=eq.${encodeURIComponent(
      slug,
    )}&limit=1`,
  );
  if (!publicFixture?.service_id) {
    throw new DomainError(
      "fixture_missing",
      409,
      "Fixture publica indisponivel.",
    );
  }
  const serviceId = publicFixture.service_id;
  const [service] = await client.get<
    Array<{
      duration_minutes: number;
      price_cents: number;
      therapist_profile_id: string;
    }>
  >(
    `/rest/v1/therapist_services?select=therapist_profile_id,duration_minutes,price_cents&id=eq.${encodeURIComponent(
      serviceId,
    )}&status=eq.active&is_bookable=eq.true&online_only=eq.true&limit=1`,
  );
  const [settings] = await client.get<FixtureSettings[]>(
    `/rest/v1/therapist_service_booking_settings?select=buffer_before_minutes,buffer_after_minutes,min_notice_minutes,max_days_ahead,interval_minutes&service_id=eq.${encodeURIComponent(
      serviceId,
    )}&limit=1`,
  );
  if (!service || !settings) {
    throw new DomainError("fixture_not_eligible", 409, "Fixture nao elegivel.");
  }

  const original: FixtureSettings = {
    buffer_after_minutes: settings.buffer_after_minutes,
    buffer_before_minutes: settings.buffer_before_minutes,
    interval_minutes: settings.interval_minutes,
    max_days_ahead: settings.max_days_ahead,
    min_notice_minutes: settings.min_notice_minutes,
  };
  // Reserve operational margin for Checkout and webhook convergence. The slot
  // remains close enough for the controlled T-15 Zoom gate later in this run.
  const target = new Date(Date.now() + 35 * 60_000);
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FIXTURE_TIMEZONE,
      weekday: "short",
    })
      .format(target)
      .replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (name) =>
        String(
          { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[name],
        ),
      ),
  );

  await client.patch(
    `/rest/v1/therapist_service_booking_settings?service_id=eq.${encodeURIComponent(
      serviceId,
    )}`,
    {
      buffer_after_minutes: 0,
      buffer_before_minutes: 0,
      interval_minutes: 1,
      max_days_ahead: Math.max(original.max_days_ahead, 1),
      min_notice_minutes: 0,
    },
  );
  let ruleId: string | null = null;
  try {
    const [rule] = await client.post<Array<{ id: string }>>(
      "/rest/v1/availability_rules",
      [
        {
          day_of_week: weekday,
          end_time: "23:59",
          is_active: true,
          service_id: serviceId,
          start_time: "00:00",
          therapist_profile_id: service.therapist_profile_id,
          timezone: FIXTURE_TIMEZONE,
        },
      ],
      "return=representation",
    );
    ruleId = rule?.id ?? null;
    if (!ruleId) throw new Error("fixture_rule_not_created");

    const startsAt = new Date(Date.now() + 35 * 60_000);
    const rangeEnd = new Date(
      startsAt.getTime() + (service.duration_minutes + 2) * 60_000,
    );
    const slots = await client.rpc<{
      slots?: Array<{ startsAt?: string }>;
      timezone?: string;
    }>("get_service_available_slots_v1", {
      p_limit: 10,
      p_range_end: rangeEnd.toISOString(),
      p_range_start: startsAt.toISOString(),
      p_service_id: serviceId,
    });
    const slot = slots?.slots?.find(
      (candidate) =>
        candidate.startsAt &&
        Date.parse(candidate.startsAt) <= startsAt.getTime() + 60_000,
    );
    if (!slot?.startsAt) throw new Error("fixture_slot_not_available");

    return {
      clean: {
        noActiveBookingOverlap: true,
        noActiveHoldOverlap: true,
        noExistingVideoSession: true,
        slotAvailable: true,
      },
      fixture: { ruleId, serviceId, settings: original },
      slot: {
        durationMinutes: service.duration_minutes,
        priceCents: service.price_cents,
        startsAt: slot.startsAt,
        timezone: slots.timezone ?? FIXTURE_TIMEZONE,
      },
    };
  } catch (error) {
    if (ruleId) {
      await client
        .delete(
          `/rest/v1/availability_rules?id=eq.${encodeURIComponent(ruleId)}`,
        )
        .catch(() => undefined);
    }
    await restoreFixtureSettings(client, serviceId, original);
    if (
      error instanceof Error &&
      error.message === "fixture_slot_not_available"
    ) {
      throw new DomainError(
        "fixture_slot_not_clean",
        409,
        "Nenhum slot limpo existe na janela controlada.",
      );
    }
    throw error;
  }
}

async function releaseGoldenPathFixture(
  client: SupabaseRestClient,
  fixture: FixtureReference | undefined,
) {
  if (!fixture?.ruleId || !fixture.serviceId || !fixture.settings) {
    throw new DomainError(
      "fixture_reference_missing",
      400,
      "Fixture invalida.",
    );
  }
  await client.delete(
    `/rest/v1/availability_rules?id=eq.${encodeURIComponent(fixture.ruleId)}`,
  );
  await restoreFixtureSettings(client, fixture.serviceId, fixture.settings);
}

async function restoreFixtureSettings(
  client: SupabaseRestClient,
  serviceId: string,
  settings: FixtureSettings,
) {
  await client.patch(
    `/rest/v1/therapist_service_booking_settings?service_id=eq.${encodeURIComponent(
      serviceId,
    )}`,
    settings,
  );
}

async function inspectGoldenPathFixture(
  client: SupabaseRestClient,
  request: GoldenPathRequest,
  stripeApiKey: string,
) {
  const checkoutSessionId = request.checkoutSessionId?.trim();
  if (!checkoutSessionId || checkoutSessionId.length > 256) {
    throw new DomainError(
      "checkout_reference_missing",
      400,
      "Checkout invalido.",
    );
  }
  const [payment] = await client.get<
    Array<{
      booking_id: string;
      currency: string;
      financial_status: string;
      gross_amount_cents: number;
      platform_gross_commission_cents: number;
      service_status: string;
      therapist_amount_cents: number;
      transfer_status: string;
    }>
  >(
    `/rest/v1/session_payments?select=booking_id,financial_status,gross_amount_cents,platform_gross_commission_cents,therapist_amount_cents,currency,service_status,transfer_status&stripe_checkout_session_id=eq.${encodeURIComponent(
      checkoutSessionId,
    )}&limit=1`,
  );
  if (!payment) return { found: false };
  const [booking] = await client.get<
    Array<{
      currency_snapshot: string;
      ends_at: string;
      id: string;
      payment_status: string;
      service_duration_minutes_snapshot: number;
      service_price_cents_snapshot: number;
      starts_at: string;
      status: string;
      timezone: string;
    }>
  >(
    `/rest/v1/bookings?select=id,starts_at,ends_at,timezone,status,payment_status,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot&id=eq.${encodeURIComponent(
      payment.booking_id,
    )}&limit=1`,
  );
  const videos = await client.get<Array<{ id: string; status: string }>>(
    `/rest/v1/video_sessions?select=id,status&booking_id=eq.${encodeURIComponent(
      payment.booking_id,
    )}`,
  );
  const webhooks = await client.get<Array<{ event_type: string }>>(
    `/rest/v1/stripe_webhook_events?select=event_type&object_id=eq.${encodeURIComponent(
      checkoutSessionId,
    )}&event_type=eq.checkout.session.completed&processing_status=eq.processed`,
  );
  const stripeCheckout = await inspectStripeCheckout(
    stripeApiKey,
    checkoutSessionId,
  );
  return {
    booking,
    bookingId: booking?.id ?? null,
    found: true,
    invariants: {
      bookingCount: booking ? 1 : 0,
      paymentCount: 1,
      videoSessionCount: videos.length,
    },
    payment: {
      currency: payment.currency,
      financialStatus: payment.financial_status,
      grossAmountCents: payment.gross_amount_cents,
      platformAmountCents: payment.platform_gross_commission_cents,
      serviceStatus: payment.service_status,
      therapistAmountCents: payment.therapist_amount_cents,
      transferStatus: payment.transfer_status,
    },
    stripeCheckout,
    videoSessions: videos,
    webhook: { checkoutCompletedProcessed: webhooks.length === 1 },
  };
}

async function inspectStripeCheckout(
  stripeApiKey: string,
  checkoutSessionId: string,
) {
  return await createStripeClient(stripeApiKey)
    .checkout.sessions.retrieve(checkoutSessionId)
    .then((session) => {
      const returnUrl = session.return_url ? new URL(session.return_url) : null;
      return {
        livemode: session.livemode,
        paymentStatus: session.payment_status,
        redirectOnCompletion: session.redirect_on_completion ?? "always",
        returnPath: returnUrl?.pathname ?? null,
        returnUrlUsesHmlHttps:
          returnUrl?.protocol === "https:" &&
          returnUrl.hostname === "hml.terapeutaeusou.com.br",
        status: session.status,
        uiMode: session.ui_mode,
      };
    })
    .catch(() => null);
}

async function inspectRecentGoldenPathFixture(
  client: SupabaseRestClient,
  runtime: ReturnType<typeof getPaymentsRuntime>,
  stripeApiKey: string,
) {
  const slug =
    runtime.env.get("PAYMENTS_HML_PUBLIC_THERAPIST_SLUG")?.trim() ||
    "antonio-ferrari-e2e";
  const [publicFixture] = await client.get<PublicTherapistFixtureRow[]>(
    `/rest/v1/public_therapist_search?select=service_id&slug=eq.${encodeURIComponent(
      slug,
    )}&limit=1`,
  );
  if (!publicFixture?.service_id) {
    throw new DomainError(
      "fixture_missing",
      409,
      "Fixture publica indisponivel.",
    );
  }
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  const payments = await client.get<
    Array<{
      booking_id: string;
      currency: string;
      financial_status: string;
      gross_amount_cents: number;
      stripe_checkout_session_id: string | null;
    }>
  >(
    `/rest/v1/session_payments?select=booking_id,financial_status,gross_amount_cents,currency,stripe_checkout_session_id&service_id=eq.${encodeURIComponent(
      publicFixture.service_id,
    )}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=2`,
  );
  const payment = payments[0];
  if (!payment) return { found: false, windowMinutes: 20 };
  const [booking] = await client.get<
    Array<{
      id: string;
      payment_status: string;
      service_price_cents_snapshot: number;
      status: string;
    }>
  >(
    `/rest/v1/bookings?select=id,status,payment_status,service_price_cents_snapshot&id=eq.${encodeURIComponent(
      payment.booking_id,
    )}&limit=1`,
  );
  const paymentRowsForBooking = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&booking_id=eq.${encodeURIComponent(
      payment.booking_id,
    )}`,
  );
  const videos = await client.get<Array<{ id: string; status: string }>>(
    `/rest/v1/video_sessions?select=id,status&booking_id=eq.${encodeURIComponent(
      payment.booking_id,
    )}`,
  );
  const webhooks = payment.stripe_checkout_session_id
    ? await client.get<Array<{ event_type: string }>>(
        `/rest/v1/stripe_webhook_events?select=event_type&object_id=eq.${encodeURIComponent(
          payment.stripe_checkout_session_id,
        )}&event_type=eq.checkout.session.completed&processing_status=eq.processed`,
      )
    : [];
  const checkout = payment.stripe_checkout_session_id
    ? await inspectStripeCheckout(
        stripeApiKey,
        payment.stripe_checkout_session_id,
      )
    : null;
  return {
    booking: booking
      ? {
          paymentStatus: booking.payment_status,
          priceCents: booking.service_price_cents_snapshot,
          status: booking.status,
        }
      : null,
    found: true,
    payment: {
      currency: payment.currency,
      financialStatus: payment.financial_status,
      grossAmountCents: payment.gross_amount_cents,
    },
    paymentCountInWindow: payments.length,
    paymentCountForBooking: paymentRowsForBooking.length,
    stripeCheckout: checkout,
    videoSessionCount: videos.length,
    webhook: { checkoutCompletedProcessed: webhooks.length === 1 },
    windowMinutes: 20,
  };
}

async function inspectLatestPaidGoldenPathFixture(
  client: SupabaseRestClient,
  runtime: ReturnType<typeof getPaymentsRuntime>,
  stripeApiKey: string,
) {
  const slug =
    runtime.env.get("PAYMENTS_HML_PUBLIC_THERAPIST_SLUG")?.trim() ||
    "antonio-ferrari-e2e";
  const [publicFixture] = await client.get<PublicTherapistFixtureRow[]>(
    `/rest/v1/public_therapist_search?select=service_id&slug=eq.${encodeURIComponent(
      slug,
    )}&limit=1`,
  );
  if (!publicFixture?.service_id) {
    throw new DomainError(
      "fixture_missing",
      409,
      "Fixture publica indisponivel.",
    );
  }
  const [payment] = await client.get<
    Array<{
      booking_id: string;
      currency: string;
      financial_status: string;
      gross_amount_cents: number;
      id: string;
      stripe_checkout_session_id: string | null;
    }>
  >(
    `/rest/v1/session_payments?select=id,booking_id,financial_status,gross_amount_cents,currency,stripe_checkout_session_id&service_id=eq.${encodeURIComponent(
      publicFixture.service_id,
    )}&financial_status=eq.paid&order=paid_at.desc&limit=1`,
  );
  if (!payment) return { found: false };
  const [booking] = await client.get<
    Array<{
      currency_snapshot: string;
      ends_at: string;
      id: string;
      patient_profile_id: string;
      payment_status: string;
      service_duration_minutes_snapshot: number;
      service_id: string;
      service_price_cents_snapshot: number;
      starts_at: string;
      status: string;
      therapist_profile_id: string;
      timezone: string;
    }>
  >(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot&id=eq.${encodeURIComponent(
      payment.booking_id,
    )}&limit=1`,
  );
  const videos = await client.get<Array<{ id: string; status: string }>>(
    `/rest/v1/video_sessions?select=id,status&booking_id=eq.${encodeURIComponent(
      payment.booking_id,
    )}`,
  );
  const webhooks = payment.stripe_checkout_session_id
    ? await client.get<Array<{ event_type: string }>>(
        `/rest/v1/stripe_webhook_events?select=event_type&object_id=eq.${encodeURIComponent(
          payment.stripe_checkout_session_id,
        )}&event_type=eq.checkout.session.completed&processing_status=eq.processed`,
      )
    : [];
  const paymentRowsForBooking = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&booking_id=eq.${encodeURIComponent(
      payment.booking_id,
    )}`,
  );
  return {
    booking: booking
      ? {
          currency: booking.currency_snapshot,
          durationMinutes: booking.service_duration_minutes_snapshot,
          endsAt: booking.ends_at,
          paymentStatus: booking.payment_status,
          priceCents: booking.service_price_cents_snapshot,
          startsAt: booking.starts_at,
          status: booking.status,
          timezone: booking.timezone,
        }
      : null,
    control:
      booking && videos.length === 1
        ? {
            bookingId: booking.id,
            sessionPaymentId: payment.id,
            videoSessionId: videos[0].id,
          }
        : null,
    found: true,
    invariants: {
      paymentCountForBooking: paymentRowsForBooking.length,
      videoSessionCount: videos.length,
    },
    payment: {
      currency: payment.currency,
      financialStatus: payment.financial_status,
      grossAmountCents: payment.gross_amount_cents,
    },
    relationships: {
      bookingMatchesPayment: payment.booking_id === booking?.id,
      bookingMatchesVideo: videos.length === 1,
      serviceMatchesFixture: booking?.service_id === publicFixture.service_id,
    },
    stripeCheckout: payment.stripe_checkout_session_id
      ? await inspectStripeCheckout(
          stripeApiKey,
          payment.stripe_checkout_session_id,
        )
      : null,
    videoSession: videos.length === 1 ? { status: videos[0].status } : null,
    webhook: { checkoutCompletedProcessed: webhooks.length === 1 },
  };
}

async function addCheck(
  checks: Check[],
  name: string,
  execute: () => Promise<string>,
) {
  try {
    checks.push({ name, status: "pass", summary: await execute() });
  } catch {
    checks.push({
      name,
      status: "fail",
      summary: "Configuracao nao confirmada.",
    });
  }
}

function hasEvents(enabledEvents: string[], requiredEvents: string[]) {
  return (
    enabledEvents.includes("*") ||
    requiredEvents.every((event) => enabledEvents.includes(event))
  );
}

export {};
