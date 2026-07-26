import crypto from "node:crypto";

import { maskIdentifier } from "./video-sdk-real-helpers.mjs";

const source = "zoom_real_homologation";

export async function createZoomRealFixtures({ admin, environment, runId }) {
  const passwordTherapist = randomPassword();
  const passwordPatient = randomPassword();
  const slug = `zoom-real-${runId}`;
  const therapistEmail = `${runId}.therapist@example.test`;
  const patientEmail = `${runId}.patient@example.test`;
  const metadata = { runId, source };
  const ids = {
    bookingId: crypto.randomUUID(),
    patientProfileId: crypto.randomUUID(),
    serviceId: crypto.randomUUID(),
    therapistProfileId: crypto.randomUUID(),
  };

  const therapistUser = await admin.authCreateUser({
    email: therapistEmail,
    password: passwordTherapist,
    role: "therapist",
  });
  const patientUser = await admin.authCreateUser({
    email: patientEmail,
    password: passwordPatient,
    role: "patient",
  });
  ids.therapistUserId = therapistUser.id;
  ids.patientUserId = patientUser.id;

  try {
    await admin.insert("profiles", [
      {
        display_name: "Homologacao Zoom Terapeuta",
        email: therapistEmail,
        id: ids.therapistUserId,
        role: "therapist",
      },
      {
        display_name: "Homologacao Zoom Paciente",
        email: patientEmail,
        id: ids.patientUserId,
        role: "patient",
      },
    ]);

    await admin.insert("patient_profiles", [
      {
        display_name: "Homologacao Zoom Paciente",
        id: ids.patientProfileId,
        marketing_consent: false,
        metadata,
        sensitive_data_consent_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
        user_id: ids.patientUserId,
      },
    ]);

    await admin.insert("therapist_profiles", [
      {
        accepts_online_sessions: true,
        city: "Sao Paulo",
        country: "BR",
        headline: "Perfil temporario para homologacao tecnica Video SDK.",
        id: ids.therapistProfileId,
        is_accepting_bookings: true,
        is_public: true,
        legal_name: "Homologacao Zoom Terapeuta",
        metadata,
        plan: "premium_plus",
        public_name: "Homologacao Zoom Terapeuta",
        slug,
        state: "SP",
        status: "approved",
        user_id: ids.therapistUserId,
      },
    ]);

    await createSubscription({ admin, ids, runId });

    const therapyId = await resolveTherapyId(admin);
    await admin.insert("therapist_services", [
      {
        currency: "BRL",
        description:
          "Sessao temporaria para homologacao tecnica do Zoom Video SDK.",
        duration_minutes: 30,
        id: ids.serviceId,
        online_only: true,
        price_cents: 17000,
        status: "active",
        therapist_profile_id: ids.therapistProfileId,
        therapy_id: therapyId,
        title: "Homologacao Zoom Video SDK",
      },
    ]);

    const now = new Date();
    const startsAt = new Date(now.getTime() - 60_000);
    const endsAt = new Date(now.getTime() + 29 * 60_000);
    await admin.insert("availability_rules", [
      {
        day_of_week: startsAt.getDay(),
        end_time: "23:59",
        is_active: true,
        service_id: ids.serviceId,
        start_time: "00:00",
        therapist_profile_id: ids.therapistProfileId,
        timezone: "America/Sao_Paulo",
      },
    ]);

    await admin.insert("bookings", [
      {
        id: ids.bookingId,
        meeting_provider: "zoom",
        patient_profile_id: ids.patientProfileId,
        payment_status: "paid",
        service_id: ids.serviceId,
        starts_at: startsAt.toISOString(),
        status: "confirmed",
        therapist_profile_id: ids.therapistProfileId,
        timezone: "America/Sao_Paulo",
        ends_at: endsAt.toISOString(),
      },
    ]);

    ids.sessionPaymentId = await createPaidSessionPayment({
      admin,
      ids,
      runId,
    });
    ids.videoSessionId = await admin.rpc(
      "ensure_video_session_for_paid_booking_v1",
      {
        p_booking_id: ids.bookingId,
        p_environment: environment,
        p_source: `zoom-real:${runId}`,
      },
    );

    return {
      credentials: {
        patient: { email: patientEmail, password: passwordPatient },
        therapist: { email: therapistEmail, password: passwordTherapist },
      },
      ids,
      sanitized: sanitizeIds(ids),
    };
  } catch (error) {
    await cleanupZoomRealFixtures({ admin, ids, runId });
    throw error;
  }
}

export async function cleanupZoomRealFixtures({ admin, ids, runId }) {
  const failures = [];
  const safeDelete = async (label, callback) => {
    try {
      await callback();
    } catch (error) {
      failures.push({
        label,
        reason: String(error?.message ?? error).slice(0, 240),
      });
    }
  };

  if (ids.bookingId) {
    await safeDelete("video_session_participations", () =>
      admin.delete(
        "video_session_participations",
        `booking_id=eq.${ids.bookingId}`,
      ),
    );
    if (ids.providerSessionId) {
      await safeDelete("zoom_video_webhook_events", () =>
        admin.delete(
          "zoom_video_webhook_events",
          `provider_session_id=eq.${encodeURIComponent(ids.providerSessionId)}`,
        ),
      );
    }
    await safeDelete("video_sessions", () =>
      admin.delete("video_sessions", `booking_id=eq.${ids.bookingId}`),
    );
    await safeDelete("financial_ledger_entries", () =>
      admin.delete(
        "financial_ledger_entries",
        ids.sessionPaymentId
          ? `or=(booking_id.eq.${ids.bookingId},session_payment_id.eq.${ids.sessionPaymentId})`
          : `booking_id=eq.${ids.bookingId}`,
      ),
    );
    await safeDelete("payments", async () => {
      try {
        await admin.delete("payments", `booking_id=eq.${ids.bookingId}`);
      } catch (error) {
        if (
          !/permission denied for table payments/.test(String(error?.message))
        ) {
          throw error;
        }
        assertUuid(ids.bookingId, "bookingId");
        admin.executeLocalSql(
          `delete from public.payments where booking_id = '${ids.bookingId}'::uuid;`,
        );
      }
    });
    await safeDelete("session_payments", () =>
      admin.delete("session_payments", `booking_id=eq.${ids.bookingId}`),
    );
    await safeDelete("bookings", () =>
      admin.delete("bookings", `id=eq.${ids.bookingId}`),
    );
  }

  if (ids.serviceId) {
    await safeDelete("availability_rules", () =>
      admin.delete("availability_rules", `service_id=eq.${ids.serviceId}`),
    );
    await safeDelete("therapist_services", () =>
      admin.delete("therapist_services", `id=eq.${ids.serviceId}`),
    );
  }

  if (ids.therapistProfileId) {
    await safeDelete("therapist_subscriptions", () =>
      admin.delete(
        "therapist_subscriptions",
        `therapist_profile_id=eq.${ids.therapistProfileId}`,
      ),
    );
    await safeDelete("therapist_profiles", () =>
      admin.delete("therapist_profiles", `id=eq.${ids.therapistProfileId}`),
    );
  }

  if (ids.patientProfileId) {
    await safeDelete("patient_profiles", () =>
      admin.delete("patient_profiles", `id=eq.${ids.patientProfileId}`),
    );
  }

  for (const userId of [ids.therapistUserId, ids.patientUserId].filter(
    Boolean,
  )) {
    await safeDelete(`auth.users:${maskIdentifier(userId)}`, () =>
      admin.authDeleteUser(userId),
    );
  }

  await assertCleanupProved({ admin, ids, runId, failures });
}

function randomPassword() {
  return `TesZoom!${crypto.randomBytes(18).toString("base64url")}`;
}

async function resolveTherapyId(admin) {
  const [published] = await admin.select(
    "therapies",
    "select=id&status=eq.published&limit=1",
  );
  if (published?.id) return published.id;
  const [anyTherapy] = await admin.select("therapies", "select=id&limit=1");
  if (anyTherapy?.id) return anyTherapy.id;
  throw new Error("Nenhuma terapia local encontrada para fixture temporaria.");
}

async function createSubscription({ admin, ids, runId }) {
  const [plan] = await admin.select(
    "billing_plans",
    "select=id&code=eq.premium_plus&limit=1",
  );
  const [price] = plan?.id
    ? await admin.select(
        "billing_plan_prices",
        `select=id&plan_id=eq.${plan.id}&is_active=eq.true&limit=1`,
      )
    : [];

  if (!plan?.id) return;

  await admin.insert("therapist_subscriptions", [
    {
      billing_plan_id: plan.id,
      billing_plan_price_id: price?.id ?? null,
      current_period_end: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      current_period_start: new Date().toISOString(),
      metadata: { runId, source },
      plan_code: "premium_plus",
      status: "active",
      stripe_subscription_id: `sub_zoom_real_${runId}`,
      therapist_profile_id: ids.therapistProfileId,
    },
  ]);
}

async function createPaidSessionPayment({ admin, ids, runId }) {
  const [policy] = await admin.select(
    "financial_policy_versions",
    "select=id,platform_commission_bps&is_active=eq.true&limit=1",
  );
  if (!policy?.id) throw new Error("Politica financeira ativa nao encontrada.");

  const gross = 17000;
  const commissionBps = Number(policy.platform_commission_bps ?? 2000);
  const therapistAmount = Math.floor((gross * (10000 - commissionBps)) / 10000);
  const platformCommission = gross - therapistAmount;
  const [payment] = await admin.insert("session_payments", [
    {
      booking_id: ids.bookingId,
      currency: "BRL",
      financial_status: "paid",
      gross_amount_cents: gross,
      metadata: { runId, source },
      paid_at: new Date().toISOString(),
      patient_profile_id: ids.patientProfileId,
      platform_commission_bps: commissionBps,
      platform_gross_commission_cents: platformCommission,
      policy_version_id: policy.id,
      service_id: ids.serviceId,
      service_status: "scheduled",
      stripe_checkout_session_id: `cs_zoom_real_${runId}`,
      stripe_payment_intent_id: `pi_zoom_real_${runId}`,
      therapist_amount_cents: therapistAmount,
      therapist_profile_id: ids.therapistProfileId,
      transfer_blocked_reason: "zoom_real_homologation",
      transfer_status: "blocked",
    },
  ]);
  return payment.id;
}

async function assertCleanupProved({ admin, failures, ids, runId }) {
  const remainingChecks = [];
  if (ids.bookingId) {
    remainingChecks.push(["bookings", `select=id&id=eq.${ids.bookingId}`]);
    remainingChecks.push([
      "video_sessions",
      `select=id&booking_id=eq.${ids.bookingId}`,
    ]);
    remainingChecks.push([
      "session_payments",
      `select=id&booking_id=eq.${ids.bookingId}`,
    ]);
  }
  if (ids.therapistProfileId) {
    remainingChecks.push([
      "therapist_profiles",
      `select=id&id=eq.${ids.therapistProfileId}`,
    ]);
  }
  if (ids.patientProfileId) {
    remainingChecks.push([
      "patient_profiles",
      `select=id&id=eq.${ids.patientProfileId}`,
    ]);
  }

  for (const [table, query] of remainingChecks) {
    const rows = await admin.select(table, query).catch((error) => {
      failures.push({
        label: `prove:${table}`,
        reason: String(error?.message ?? error).slice(0, 240),
      });
      return [];
    });
    if (rows.length > 0) {
      failures.push({
        label: `remaining:${table}`,
        reason: "dados temporarios ainda encontrados",
      });
    }
  }

  if (failures.length > 0) {
    const error = new Error("cleanup_not_proved");
    error.details = {
      failures,
      manualProcedure:
        "Pare novos testes, encerre sessoes Zoom ativas com npm run zoom:video-sdk:real-preflight e remova manualmente registros marcados pelo runId respeitando FKs: participations, video_sessions, ledger, session_payments, booking_events, bookings, services, profiles e auth users.",
      runId,
      sanitizedIds: sanitizeIds(ids),
    };
    throw error;
  }
}

function sanitizeIds(ids) {
  return Object.fromEntries(
    Object.entries(ids)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [key, maskIdentifier(String(value))]),
  );
}

function assertUuid(value, label) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value ?? ""),
    )
  ) {
    throw new Error(`${label}_invalid_uuid`);
  }
}
