import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadZoomEnv, sanitizeError } from "./env-loader.mjs";

loadZoomEnv();

const report = [];
const correlationId = crypto.randomUUID().slice(0, 8);
const token = process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN;
let supabase = null;
let paidBooking = null;
let zoomMeetingId = null;

if (process.env.ALLOW_REAL_ZOOM_TESTS !== "true") {
  console.log(
    JSON.stringify(
      {
        skipped: true,
        reason: "ALLOW_REAL_ZOOM_TESTS diferente de true",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!token) {
  console.error(
    JSON.stringify({ error: "PAYMENTS_INTERNAL_OPERATIONS_TOKEN ausente" }),
  );
  process.exit(1);
}

try {
  supabase = getLocalSupabase();
  await assertUnpaidBookingDoesNotEnqueue();
  paidBooking = await findPaidBookingWithoutZoomMeeting();

  await enqueueJob("create", `tes-edge-create-${correlationId}`);
  await runConcurrentProcessors("create-concurrency");
  await runProcessor("create-idempotent-second-run");
  const createdState = await getZoomMeetingState();
  zoomMeetingId = createdState.zoom_meeting_id;
  report.push({
    jobs: await countJobs(paidBooking.id),
    operation: "validate-create",
    remoteMeeting: zoomMeetingId ? "created" : "missing",
    status:
      createdState.status === "scheduled" && zoomMeetingId
        ? "sucesso"
        : "falha",
  });

  await enqueueJob("create", `tes-edge-create-${correlationId}`);
  report.push({
    jobs: await countJobs(paidBooking.id, "create"),
    operation: "validate-duplicate-enqueue",
    status:
      (await countJobs(paidBooking.id, "create")) === 1 ? "sucesso" : "falha",
  });

  await enqueueJob("update", `tes-edge-update-${correlationId}`, {
    reason: "edge-flow-smoke",
  });
  await runProcessor("process-update");
  const updatedState = await getZoomMeetingState();
  report.push({
    operation: "validate-update",
    status:
      updatedState.status === "scheduled" &&
      updatedState.zoom_meeting_id === zoomMeetingId
        ? "sucesso"
        : "falha",
  });

  await enqueueJob("cancel", `tes-edge-cancel-${correlationId}`);
  await runProcessor("process-cancel");
  const canceledState = await getZoomMeetingState();
  report.push({
    cleanup: canceledState.status === "canceled" ? "sim" : "nao",
    operation: "validate-cancel",
    status: canceledState.status === "canceled" ? "sucesso" : "falha",
  });
} catch (error) {
  report.push({
    cleanup: zoomMeetingId ? "pendente" : "nao_aplicavel",
    error: sanitizeError(error),
    operation: "edge-flow",
    status: "falha",
  });
} finally {
  await cleanupRemoteIfNeeded();
  await cleanupLocalState();
  console.log(JSON.stringify(report, null, 2));
  if (report.some((entry) => entry.status === "falha")) {
    process.exitCode = 1;
  }
}

async function assertUnpaidBookingDoesNotEnqueue() {
  const [unpaid] = await supabaseFetch(
    "/rest/v1/bookings?select=id,payment_status,status&payment_status=neq.paid&limit=1",
  );
  if (!unpaid) {
    report.push({
      operation: "validate-unpaid-booking",
      status: "sem_fixture",
    });
    return;
  }

  const started = Date.now();
  const response = await rpcRaw("enqueue_zoom_meeting_job_v1", {
    p_booking_id: unpaid.id,
    p_environment: process.env.ZOOM_ENVIRONMENT,
    p_idempotency_key: `tes-edge-unpaid-${correlationId}`,
    p_operation: "create",
    p_payload: { topic: `[TES DEV TEST] ${correlationId}` },
  });
  report.push({
    durationMs: Date.now() - started,
    httpStatus: response.status,
    operation: "validate-unpaid-booking",
    status: response.ok ? "falha" : "sucesso",
  });
}

async function findPaidBookingWithoutZoomMeeting() {
  const bookings = await supabaseFetch(
    "/rest/v1/session_payments?select=booking_id,financial_status,bookings(id,status,payment_status,starts_at,ends_at,timezone)&financial_status=eq.paid&limit=20",
  );

  for (const row of bookings) {
    const booking = row.bookings;
    if (!booking || booking.status !== "confirmed") continue;
    const existing = await supabaseFetch(
      `/rest/v1/zoom_meetings?select=id&booking_id=eq.${encodeURIComponent(booking.id)}&limit=1`,
    );
    if (!existing.length) return booking;
  }

  throw new Error("zoom_edge_paid_booking_fixture_unavailable");
}

async function enqueueJob(operation, idempotencyKey, payload = {}) {
  const started = Date.now();
  const response = await rpcRaw("enqueue_zoom_meeting_job_v1", {
    p_booking_id: paidBooking.id,
    p_environment: process.env.ZOOM_ENVIRONMENT,
    p_idempotency_key: idempotencyKey,
    p_operation: operation,
    p_payload: {
      hostUserId: process.env.ZOOM_DEFAULT_HOST_USER_ID,
      topic: `[TES DEV TEST] ${correlationId}`,
      ...payload,
    },
  });
  report.push({
    durationMs: Date.now() - started,
    httpStatus: response.status,
    operation: `enqueue-${operation}`,
    status: response.ok ? "sucesso" : "falha",
  });
  if (!response.ok)
    throw new Error(`enqueue_${operation}_http_${response.status}`);
}

async function runConcurrentProcessors(operation) {
  const results = await Promise.all([
    runProcessor(operation),
    runProcessor(operation),
  ]);
  const processed = results.filter(
    (result) => result?.body?.data?.processed,
  ).length;
  report.push({
    operation,
    processed,
    status: processed === 1 ? "sucesso" : "falha",
  });
}

async function runProcessor(operation) {
  const started = Date.now();
  const endpoint =
    process.env.ZOOM_JOBS_PROCESS_URL ??
    `${supabase.url}/functions/v1/zoom-jobs-process`;
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "x-tes-internal-operations-token": token,
    },
    method: "POST",
  });
  const body = await response.json().catch(() => ({}));
  report.push({
    durationMs: Date.now() - started,
    httpStatus: response.status,
    operation,
    processed: body?.data?.processed ?? false,
    status: response.ok ? "sucesso" : "falha",
  });
  if (!response.ok) throw new Error(`processor_http_${response.status}`);

  return { body, response };
}

async function getZoomMeetingState() {
  const [state] = await supabaseFetch(
    `/rest/v1/zoom_meetings?select=id,status,zoom_meeting_id,zoom_meeting_uuid,start_url_encrypted,passcode_encrypted&booking_id=eq.${encodeURIComponent(paidBooking.id)}&limit=1`,
  );
  if (!state) throw new Error("zoom_local_meeting_missing");
  if (state.start_url_encrypted || state.passcode_encrypted) {
    throw new Error("zoom_sensitive_value_persisted");
  }

  return state;
}

async function countJobs(bookingId, operation) {
  const query = operation
    ? `&operation=eq.${encodeURIComponent(operation)}`
    : "";
  const rows = await supabaseFetch(
    `/rest/v1/zoom_meeting_jobs?select=id&booking_id=eq.${encodeURIComponent(bookingId)}${query}`,
  );

  return rows.length;
}

async function cleanupLocalState() {
  if (!supabase || !paidBooking) return;
  await supabaseFetch(
    `/rest/v1/zoom_meeting_jobs?booking_id=eq.${encodeURIComponent(paidBooking.id)}`,
    { method: "DELETE" },
  ).catch(() => null);
  await supabaseFetch(
    `/rest/v1/zoom_meetings?booking_id=eq.${encodeURIComponent(paidBooking.id)}`,
    { method: "DELETE" },
  ).catch(() => null);
  report.push({
    cleanup: "sim",
    operation: "cleanup-local-edge-flow",
    status: "sucesso",
  });
}

async function cleanupRemoteIfNeeded() {
  if (!zoomMeetingId) return;

  try {
    const state = paidBooking
      ? await getZoomMeetingState().catch(() => null)
      : null;
    if (state?.status === "canceled") return;

    const accessToken = await requestZoomAccessToken();
    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: "DELETE",
      },
    );
    report.push({
      cleanup: response.ok || response.status === 404 ? "sim" : "nao",
      httpStatus: response.status,
      operation: "cleanup-remote-edge-flow",
      status: response.ok || response.status === 404 ? "sucesso" : "falha",
    });
  } catch (error) {
    report.push({
      cleanup: "nao",
      error: sanitizeError(error),
      operation: "cleanup-remote-edge-flow",
      status: "falha",
    });
  }
}

async function requestZoomAccessToken() {
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", process.env.ZOOM_ACCOUNT_ID);
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.ZOOM_S2S_CLIENT_ID}:${process.env.ZOOM_S2S_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    method: "POST",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`zoom_cleanup_oauth_http_${response.status}`);
  }

  return body.access_token;
}

async function rpcRaw(name, body) {
  return fetch(`${supabase.url}/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${supabase.url}${path}`, {
    ...options,
    headers: {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`supabase_http_${response.status}`);

  return text ? JSON.parse(text) : [];
}

function getLocalSupabase() {
  const status = JSON.parse(
    execFileSync(statusCommand(), statusArgs(), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );

  return {
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    url: status.API_URL,
  };
}

function statusCommand() {
  return process.platform === "win32" ? "powershell.exe" : "npx";
}

function statusArgs() {
  return process.platform === "win32"
    ? ["-NoProfile", "-Command", "npx supabase status -o json"]
    : ["supabase", "status", "-o", "json"];
}
