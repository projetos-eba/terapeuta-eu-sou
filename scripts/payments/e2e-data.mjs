import {
  getSupabaseUrl,
  loadEnvFiles,
  requireSupabaseServiceRoleKey,
} from "./env-utils.mjs";
import { execFileSync } from "node:child_process";

loadEnvFiles();

const command = process.argv[2] ?? "status";
const runId =
  process.env.PAYMENTS_E2E_RUN_ID?.trim() || "tes-payments-e2e-local";
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = requireSupabaseServiceRoleKey();
const password =
  process.env.PAYMENTS_E2E_PASSWORD?.trim() || "TesE2e!ChangeMe2026";
const emailDomain = "example.test";
const metadata = { e2e: true, e2e_run_id: runId, system: "tes" };

const users = [
  {
    key: "therapist_free",
    role: "therapist",
    plan: "free",
    name: "TES E2E Terapeuta Free",
  },
  {
    key: "therapist_premium",
    role: "therapist",
    plan: "premium",
    name: "TES E2E Terapeuta Premium",
  },
  {
    key: "therapist_plus",
    role: "therapist",
    plan: "premium_plus",
    name: "TES E2E Terapeuta Plus",
  },
  {
    key: "therapist_connect_pending",
    role: "therapist",
    plan: "premium",
    name: "TES E2E Connect Pendente",
  },
  {
    key: "therapist_connect_ready",
    role: "therapist",
    plan: "premium_plus",
    name: "TES E2E Connect Apto",
  },
  { key: "client_one", role: "patient", name: "TES E2E Cliente Um" },
  { key: "client_two", role: "patient", name: "TES E2E Cliente Dois" },
].map((user) => ({
  ...user,
  email: `${runId}.${user.key}@${emailDomain}`.toLowerCase(),
}));

if (!["cleanup", "seed", "status"].includes(command)) {
  console.error("Use: node scripts/payments/e2e-data.mjs seed|status|cleanup");
  process.exit(1);
}

if (command === "cleanup") {
  await cleanup();
} else if (command === "seed") {
  await cleanup();
  await seed();
} else {
  await status();
}

async function seed() {
  const authUsers = new Map();

  for (const user of users) {
    const authUser = await createAuthUser(user);
    authUsers.set(user.key, authUser);
    await upsertProfile(authUser.id, user);
  }

  const therapy = await firstPublishedTherapy();
  const policy = await activePolicy();
  const patients = {};
  const therapists = {};

  for (const user of users.filter((item) => item.role === "patient")) {
    patients[user.key] = await createPatientProfile(
      authUsers.get(user.key).id,
      user,
    );
  }

  for (const user of users.filter((item) => item.role === "therapist")) {
    therapists[user.key] = await createTherapistProfile(
      authUsers.get(user.key).id,
      user,
    );
  }

  const services = {};
  for (const [key, therapist] of Object.entries(therapists)) {
    services[key] = await createService(therapist.id, therapy.id, key);
    await createAvailability(therapist.id, services[key].id);
  }

  await createConnectAccount(therapists.therapist_connect_pending.id, {
    onboarding_status: "requirements_due",
    operational_status: "restricted",
    stripe_account_id: `acct_e2e_pending_${shortRunId()}`,
    stripe_transfers_status: "inactive",
  });
  const readyConnect = await createConnectAccount(
    therapists.therapist_connect_ready.id,
    {
      onboarding_status: "ready",
      operational_status: "ready",
      stripe_account_id: `acct_e2e_ready_${shortRunId()}`,
      stripe_transfers_status: "active",
    },
  );

  await createScenario({
    key: "future_pending_payment",
    patient: patients.client_one,
    policy,
    service: services.therapist_premium,
    therapist: therapists.therapist_premium,
    startsAt: addDays(14),
    financialStatus: "pending",
    serviceStatus: "scheduled",
    transferStatus: "not_eligible",
  });
  await createScenario({
    key: "paid_waiting_confirmation",
    patient: patients.client_one,
    policy,
    service: services.therapist_connect_ready,
    therapist: therapists.therapist_connect_ready,
    startsAt: addDays(-2),
    financialStatus: "paid",
    serviceStatus: "scheduled",
    transferStatus: "waiting_confirmation",
  });
  await createScenario({
    key: "eligible",
    patient: patients.client_two,
    policy,
    service: services.therapist_connect_ready,
    therapist: therapists.therapist_connect_ready,
    startsAt: addDays(-10),
    financialStatus: "paid",
    serviceStatus: "confirmed_by_therapist",
    transferStatus: "eligible",
    serviceConfirmedAt: addDays(-8),
    eligibleAt: addDays(-1),
  });
  await createScenario({
    key: "disputed",
    patient: patients.client_two,
    policy,
    service: services.therapist_connect_ready,
    therapist: therapists.therapist_connect_ready,
    startsAt: addDays(-12),
    financialStatus: "disputed",
    serviceStatus: "confirmed_by_therapist",
    transferStatus: "blocked",
    disputed: true,
  });
  await createScenario({
    key: "refunded",
    patient: patients.client_one,
    policy,
    service: services.therapist_connect_ready,
    therapist: therapists.therapist_connect_ready,
    startsAt: addDays(-5),
    financialStatus: "refunded",
    serviceStatus: "canceled",
    transferStatus: "blocked",
    refunded: true,
  });
  const transferred = await createScenario({
    key: "transferred",
    patient: patients.client_two,
    policy,
    service: services.therapist_connect_ready,
    therapist: therapists.therapist_connect_ready,
    startsAt: addDays(-20),
    financialStatus: "paid",
    serviceStatus: "confirmed_by_patient_review",
    transferStatus: "transferred",
    serviceConfirmedAt: addDays(-18),
    eligibleAt: addDays(-11),
  });
  await createTransferredBatch(transferred, readyConnect.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        users: users.map(({ email, key, role }) => ({ email, key, role })),
        scenarios: 6,
      },
      null,
      2,
    ),
  );
}

async function status() {
  const profiles = await Promise.all(
    users.map((user) =>
      supabaseJson(
        `/rest/v1/profiles?select=id,role,email&email=eq.${encodeURIComponent(user.email)}&limit=1`,
      ),
    ),
  );
  const sessionPayments = await supabaseJson(
    `/rest/v1/session_payments?select=id,financial_status,service_status,transfer_status&metadata->>e2e_run_id=eq.${encodeURIComponent(runId)}`,
  );
  const batches = await supabaseJson(
    `/rest/v1/payout_batches?select=id,status,item_count&metadata->>e2e_run_id=eq.${encodeURIComponent(runId)}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        authProfileCount: profiles.flat().length,
        sessionPaymentCount: sessionPayments.length,
        payoutBatchCount: batches.length,
      },
      null,
      2,
    ),
  );
}

async function cleanup() {
  const patientIds = await idsByMetadata("patient_profiles");
  const therapistIds = await idsByMetadata("therapist_profiles");
  const bookingIds = await bookingIdsFor(patientIds, therapistIds);
  const sessionPaymentIds = await idsByMetadata("session_payments");
  const batchIds = await idsByMetadata("payout_batches");

  await deleteIn(
    "financial_ledger_entries",
    "session_payment_id",
    sessionPaymentIds,
  );
  await deleteIn("stripe_transfer_reversals", "metadata->>e2e_run_id", [runId]);
  await deleteIn("stripe_transfers", "session_payment_id", sessionPaymentIds);
  await deleteIn("payout_batch_items", "payout_batch_id", batchIds);
  await deleteIn("payout_batch_therapists", "payout_batch_id", batchIds);
  await deleteIn("payout_batches", "id", batchIds);
  await deleteIn("session_disputes", "session_payment_id", sessionPaymentIds);
  await deleteIn("session_refunds", "session_payment_id", sessionPaymentIds);
  await deleteIn(
    "session_cancellation_decisions",
    "session_payment_id",
    sessionPaymentIds,
  );
  await deleteIn(
    "session_service_confirmations",
    "session_payment_id",
    sessionPaymentIds,
  );
  await deleteIn(
    "session_payment_attempts",
    "session_payment_id",
    sessionPaymentIds,
  );
  await deleteIn("session_payments", "id", sessionPaymentIds);
  await deleteLegacyPayments(bookingIds);
  await deleteIn("reviews", "booking_id", bookingIds);
  await deleteBookings(bookingIds);
  await deleteIn("availability_rules", "therapist_profile_id", therapistIds);
  await deleteIn("therapist_services", "therapist_profile_id", therapistIds);
  await deleteIn(
    "therapist_connect_account_snapshots",
    "connect_account_id",
    await idsByMetadata("therapist_connect_accounts"),
  );
  await deleteIn(
    "therapist_connect_accounts",
    "therapist_profile_id",
    therapistIds,
  );
  await deleteIn(
    "therapist_subscriptions",
    "therapist_profile_id",
    therapistIds,
  );
  await deleteIn("patient_profiles", "id", patientIds);
  await deleteIn("therapist_profiles", "id", therapistIds);

  for (const user of users) {
    const [profile] = await supabaseJson(
      `/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(user.email)}&limit=1`,
    );
    if (profile?.id) await deleteAuthUser(profile.id);
  }

  console.log(JSON.stringify({ ok: true, runId, cleaned: true }, null, 2));
}

async function createAuthUser(user) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    body: JSON.stringify({
      email: user.email,
      email_confirm: true,
      password,
      user_metadata: { e2e_run_id: runId, role: user.role },
    }),
    headers: authHeaders(),
    method: "POST",
  });
  const payload = await readJson(response);
  if (!response.ok)
    throw new Error(`Auth user create failed: ${response.status}`);
  return payload;
}

async function deleteAuthUser(userId) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: authHeaders(),
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Auth user delete failed: ${response.status}`);
  }
}

async function upsertProfile(userId, user) {
  await supabaseJson("/rest/v1/profiles?on_conflict=id", {
    body: JSON.stringify({
      display_name: user.name,
      email: user.email,
      id: userId,
      role: user.role,
    }),
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function createPatientProfile(userId, user) {
  const rows = await supabaseJson("/rest/v1/patient_profiles?select=id", {
    body: JSON.stringify({
      birth_date: "1990-01-01",
      display_name: user.name,
      metadata,
      user_id: userId,
    }),
    method: "POST",
    prefer: "return=representation",
  });
  return rows[0];
}

async function createTherapistProfile(userId, user) {
  const rows = await supabaseJson("/rest/v1/therapist_profiles?select=id", {
    body: JSON.stringify({
      bio: "Perfil E2E para validacao de pagamentos TES.",
      headline: "Atendimento E2E",
      is_accepting_bookings: true,
      is_public: true,
      metadata,
      plan: user.plan,
      public_name: user.name,
      slug: `${runId}-${user.key}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      status: "approved",
      user_id: userId,
    }),
    method: "POST",
    prefer: "return=representation",
  });
  return rows[0];
}

async function firstPublishedTherapy() {
  const rows = await supabaseJson(
    "/rest/v1/therapies?select=id&status=eq.published&limit=1",
  );
  if (!rows[0])
    throw new Error("No published therapy found. Run db reset/seed first.");
  return rows[0];
}

async function activePolicy() {
  const rows = await supabaseJson(
    "/rest/v1/financial_policy_versions?select=id,platform_commission_bps&is_active=eq.true&limit=1",
  );
  if (!rows[0]) throw new Error("No active payment policy found.");
  return rows[0];
}

async function createService(therapistId, therapyId, key) {
  const rows = await supabaseJson(
    "/rest/v1/therapist_services?select=id,price_cents",
    {
      body: JSON.stringify({
        currency: "BRL",
        description: "Servico E2E para validacao de pagamentos.",
        duration_minutes: 50,
        price_cents: key.includes("plus") ? 24000 : 18000,
        status: "active",
        therapist_profile_id: therapistId,
        therapy_id: therapyId,
        title: `Sessao E2E ${key}`,
      }),
      method: "POST",
      prefer: "return=representation",
    },
  );
  return rows[0];
}

async function createAvailability(therapistId, serviceId) {
  await supabaseJson("/rest/v1/availability_rules", {
    body: JSON.stringify({
      day_of_week: 2,
      end_time: "18:00",
      service_id: serviceId,
      start_time: "09:00",
      therapist_profile_id: therapistId,
    }),
    method: "POST",
    prefer: "return=minimal",
  });
}

async function createConnectAccount(therapistId, input) {
  const rows = await supabaseJson(
    "/rest/v1/therapist_connect_accounts?select=id",
    {
      body: JSON.stringify({
        dashboard_type: "express",
        fees_collector: "application",
        losses_collector: "application",
        metadata,
        onboarding_status: input.onboarding_status,
        operational_status: input.operational_status,
        pending_requirements:
          input.stripe_transfers_status === "active"
            ? []
            : { currentlyDue: ["external_account"], eventuallyDue: [] },
        stripe_account_id: input.stripe_account_id,
        stripe_transfers_status: input.stripe_transfers_status,
        therapist_profile_id: therapistId,
      }),
      method: "POST",
      prefer: "return=representation",
    },
  );
  return rows[0];
}

async function createScenario(input) {
  const endsAt = new Date(
    new Date(input.startsAt).getTime() + 50 * 60000,
  ).toISOString();
  const [booking] = await supabaseJson("/rest/v1/bookings?select=id", {
    body: JSON.stringify({
      ends_at: endsAt,
      patient_profile_id: input.patient.id,
      payment_status:
        input.financialStatus === "paid"
          ? "paid"
          : input.financialStatus === "refunded"
            ? "refunded"
            : "pending",
      service_id: input.service.id,
      starts_at: input.startsAt,
      status:
        input.serviceStatus === "canceled"
          ? "cancelled_by_patient"
          : input.serviceStatus.startsWith("confirmed")
            ? "completed"
            : "confirmed",
      therapist_profile_id: input.therapist.id,
    }),
    method: "POST",
    prefer: "return=representation",
  });
  const gross = input.service.price_cents;
  const therapistAmount = Math.floor(
    (gross * (10000 - input.policy.platform_commission_bps)) / 10000,
  );
  const platformAmount = gross - therapistAmount;
  const [payment] = await supabaseJson(
    "/rest/v1/session_payments?select=id,booking_id,therapist_amount_cents",
    {
      body: JSON.stringify({
        booking_id: booking.id,
        disputed_at: input.disputed ? new Date().toISOString() : null,
        eligible_at: input.eligibleAt ?? null,
        financial_status: input.financialStatus,
        gross_amount_cents: gross,
        metadata: { ...metadata, scenario: input.key },
        paid_at: ["paid", "disputed", "refunded"].includes(
          input.financialStatus,
        )
          ? addDays(-3)
          : null,
        patient_profile_id: input.patient.id,
        platform_commission_bps: input.policy.platform_commission_bps,
        platform_gross_commission_cents: platformAmount,
        policy_version_id: input.policy.id,
        refund_pending: input.refunded || input.disputed || false,
        service_confirmed_at: input.serviceConfirmedAt ?? null,
        service_confirmation_source: input.serviceConfirmedAt
          ? "therapist_manual"
          : null,
        service_id: input.service.id,
        service_status: input.serviceStatus,
        stripe_charge_id: `ch_e2e_${shortRunId()}_${input.key}`,
        stripe_payment_intent_id: `pi_e2e_${shortRunId()}_${input.key}`,
        therapist_amount_cents: therapistAmount,
        therapist_profile_id: input.therapist.id,
        transfer_blocked_reason: input.disputed
          ? "disputed"
          : input.refunded
            ? "refund"
            : null,
        transfer_status: input.transferStatus,
      }),
      method: "POST",
      prefer: "return=representation",
    },
  );
  await insertLegacyPaymentProjection({
    body: JSON.stringify({
      amount_cents: gross,
      booking_id: booking.id,
      patient_profile_id: input.patient.id,
      platform_fee_cents: platformAmount,
      status:
        input.financialStatus === "refunded"
          ? "refunded"
          : input.financialStatus === "paid"
            ? "paid"
            : "pending",
      therapist_amount_cents: therapistAmount,
      therapist_profile_id: input.therapist.id,
    }),
    method: "POST",
    prefer: "return=minimal",
  });
  if (input.disputed) {
    await supabaseJson("/rest/v1/session_disputes", {
      body: JSON.stringify({
        amount_cents: gross,
        metadata,
        session_payment_id: payment.id,
        status: "needs_response",
        stripe_charge_id: `ch_e2e_${shortRunId()}_${input.key}`,
        stripe_dispute_id: `dp_e2e_${shortRunId()}_${input.key}`,
      }),
      method: "POST",
      prefer: "return=minimal",
    });
  }
  if (input.refunded) {
    await supabaseJson("/rest/v1/session_refunds", {
      body: JSON.stringify({
        amount_cents: gross,
        metadata,
        processed_at: new Date().toISOString(),
        reason: "e2e_refund",
        session_payment_id: payment.id,
        status: "succeeded",
        stripe_refund_id: `re_e2e_${shortRunId()}_${input.key}`,
      }),
      method: "POST",
      prefer: "return=minimal",
    });
  }
  return payment;
}

async function createTransferredBatch(payment, connectAccountId) {
  const [batch] = await supabaseJson("/rest/v1/payout_batches?select=id", {
    body: JSON.stringify({
      cutoff_at: addDays(-1),
      item_count: 1,
      metadata,
      processed_at: new Date().toISOString(),
      reference_period_end: isoDate(addDays(-1)),
      reference_period_start: isoDate(addDays(-8)),
      status: "completed",
      therapist_amount_cents: payment.therapist_amount_cents,
      therapist_count: 1,
    }),
    method: "POST",
    prefer: "return=representation",
  });
  const [item] = await supabaseJson("/rest/v1/payout_batch_items?select=id", {
    body: JSON.stringify({
      amount_cents: payment.therapist_amount_cents,
      booking_id: payment.booking_id,
      metadata,
      payout_batch_id: batch.id,
      session_payment_id: payment.id,
      status: "transferred",
      therapist_profile_id: (
        await supabaseJson(
          `/rest/v1/session_payments?select=therapist_profile_id&id=eq.${payment.id}&limit=1`,
        )
      )[0].therapist_profile_id,
    }),
    method: "POST",
    prefer: "return=representation",
  });
  await supabaseJson("/rest/v1/stripe_transfers", {
    body: JSON.stringify({
      amount_cents: payment.therapist_amount_cents,
      connect_account_id: connectAccountId,
      idempotency_key: `tes:e2e:${runId}:transfer:${item.id}`,
      metadata,
      payout_batch_item_id: item.id,
      session_payment_id: payment.id,
      status: "transferred",
      stripe_transfer_id: `tr_e2e_${shortRunId()}_transferred`,
      therapist_profile_id: (
        await supabaseJson(
          `/rest/v1/session_payments?select=therapist_profile_id&id=eq.${payment.id}&limit=1`,
        )
      )[0].therapist_profile_id,
      transferred_at: new Date().toISOString(),
    }),
    method: "POST",
    prefer: "return=minimal",
  });
}

async function idsByMetadata(table) {
  const rows = await supabaseJson(
    `/rest/v1/${table}?select=id&metadata->>e2e_run_id=eq.${encodeURIComponent(runId)}`,
  );
  return rows.map((row) => row.id);
}

async function bookingIdsFor(patientIds, therapistIds) {
  const ids = new Set();
  for (const id of patientIds) {
    for (const row of await supabaseJson(
      `/rest/v1/bookings?select=id&patient_profile_id=eq.${id}`,
    ))
      ids.add(row.id);
  }
  for (const id of therapistIds) {
    for (const row of await supabaseJson(
      `/rest/v1/bookings?select=id&therapist_profile_id=eq.${id}`,
    ))
      ids.add(row.id);
  }
  return [...ids];
}

async function deleteIn(table, column, values) {
  for (const value of values.filter(Boolean)) {
    await supabaseJson(
      `/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`,
      {
        method: "DELETE",
        prefer: "return=minimal",
      },
    );
  }
}

async function deleteInOptional(table, column, values) {
  for (const value of values.filter(Boolean)) {
    try {
      await supabaseJson(
        `/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`,
        {
          method: "DELETE",
          prefer: "return=minimal",
        },
      );
    } catch (error) {
      if (isLegacyPaymentsPermissionError(table, error)) {
        console.warn(
          "Skipping legacy payments cleanup because public.payments is not writable in this environment.",
        );
        continue;
      }

      throw error;
    }
  }
}

async function deleteLegacyPayments(bookingIds) {
  if (tryDeleteLegacyPaymentsWithLocalDocker(bookingIds)) return;

  await deleteInOptional("payments", "booking_id", bookingIds);
}

function tryDeleteLegacyPaymentsWithLocalDocker(bookingIds) {
  const ids = bookingIds.filter(Boolean);
  if (!ids.length) return true;

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(supabaseUrl)) {
    return false;
  }

  try {
    const containers = execFileSync(
      "docker",
      ["ps", "--format", "{{.Names}}"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    const dbContainer = containers.find((name) =>
      name.startsWith("supabase_db_"),
    );

    if (!dbContainer) return false;

    const uuidList = ids
      .map((id) => `'${String(id).replace(/'/g, "''")}'::uuid`)
      .join(",");
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        dbContainer,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        `delete from public.payments where booking_id = any(array[${uuidList}]);`,
      ],
      {
        stdio: "ignore",
      },
    );

    return true;
  } catch {
    return false;
  }
}

async function deleteBookings(values) {
  for (const value of values.filter(Boolean)) {
    try {
      await supabaseJson(
        `/rest/v1/bookings?id=eq.${encodeURIComponent(value)}`,
        {
          method: "DELETE",
          prefer: "return=minimal",
        },
      );
    } catch (error) {
      if (isLegacyPaymentsBookingReferenceError(error)) {
        console.warn(
          "Skipping booking cleanup because a legacy public.payments row still references it.",
        );
        continue;
      }

      throw error;
    }
  }
}

async function insertLegacyPaymentProjection(init) {
  try {
    await supabaseJson("/rest/v1/payments", init);
  } catch (error) {
    if (isLegacyPaymentsPermissionError("payments", error)) {
      console.warn(
        "Skipping legacy payments projection seed because public.payments is not writable in this environment.",
      );
      return;
    }

    throw error;
  }
}

function isLegacyPaymentsPermissionError(table, error) {
  const message = String(error instanceof Error ? error.message : error);
  return (
    table === "payments" &&
    message.includes("/rest/v1/payments") &&
    message.includes("permission denied for table payments")
  );
}

function isLegacyPaymentsBookingReferenceError(error) {
  const message = String(error instanceof Error ? error.message : error);
  return (
    message.includes("/rest/v1/bookings") &&
    message.includes("payments_booking_id_fkey")
  );
}

async function supabaseJson(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      "content-type": "application/json",
      Prefer: init.prefer ?? "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Supabase ${init.method ?? "GET"} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload ?? [];
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function authHeaders() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };
}

function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function isoDate(value) {
  return value.slice(0, 10);
}

function shortRunId() {
  return (
    runId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12) || "tes"
  );
}
