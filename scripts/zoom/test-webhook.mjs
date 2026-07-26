import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadZoomEnv, sanitizeError } from "./env-loader.mjs";

loadZoomEnv();

const endpoint =
  process.env.ZOOM_LOCAL_WEBHOOK_URL ??
  "http://127.0.0.1:54321/functions/v1/zoom-webhook";
const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
const report = [];
const correlationId = crypto.randomUUID().slice(0, 8);
const meetingId = `tes-${correlationId}`;
const meetingUuid = `uuid-${correlationId}`;
let localMeetingId = null;
let supabase = null;
let fatalError = null;

if (!secret) {
  console.error(JSON.stringify({ error: "ZOOM_WEBHOOK_SECRET_TOKEN ausente" }));
  process.exit(1);
}

try {
  supabase = getLocalSupabase();
  localMeetingId = await seedLocalZoomMeeting();

  await sendScenario("endpoint.url_validation", {
    event: "endpoint.url_validation",
    payload: { plainToken: "plain-local-token" },
  });
  await sendScenario("meeting.started", meetingEvent("meeting.started"));
  await sendScenario(
    "meeting.participant_waiting",
    participantEvent("meeting.participant_waiting", "participant-a"),
  );
  await sendScenario(
    "meeting.participant_joined",
    participantEvent("meeting.participant_joined", "participant-a"),
  );
  await sendScenario(
    "meeting.participant_left",
    participantEvent("meeting.participant_left", "participant-a", {
      duration: 60,
    }),
  );
  await sendScenario("meeting.ended", meetingEvent("meeting.ended"));
  await sendScenario("unknown-event", meetingEvent("meeting.unknown_event"), {
    expectBodyField: "ignored",
  });

  const duplicateBody = meetingEvent("meeting.started");
  const duplicateRequestId = crypto.randomUUID();
  await sendScenario("duplicate-first", duplicateBody, { duplicateRequestId });
  await sendScenario("duplicate-second", duplicateBody, {
    duplicateRequestId,
    expectBodyField: "duplicate",
  });

  await sendRawScenario("malformed-json", "{", { expectedStatus: 400 });
  await sendRawScenario(
    "missing-signature",
    JSON.stringify(meetingEvent("meeting.started")),
    {
      expectedStatus: 400,
      omitSignature: true,
    },
  );
  await sendRawScenario(
    "invalid-signature",
    JSON.stringify(meetingEvent("meeting.started")),
    {
      expectedStatus: 400,
      signatureOverride: "v0=invalid",
    },
  );
  await sendRawScenario(
    "missing-timestamp",
    JSON.stringify(meetingEvent("meeting.started")),
    {
      expectedStatus: 400,
      omitTimestamp: true,
    },
  );
  await sendRawScenario(
    "future-timestamp",
    JSON.stringify(meetingEvent("meeting.started")),
    {
      expectedStatus: 400,
      timestampOverride: String(Math.floor(Date.now() / 1000) + 3600),
    },
  );
  await sendRawScenario(
    "expired-replay",
    JSON.stringify(meetingEvent("meeting.started")),
    {
      expectedStatus: 400,
      timestampOverride: String(Math.floor(Date.now() / 1000) - 3600),
    },
  );
  await sendScenario(
    "unicode-long-name",
    participantEvent("meeting.participant_joined", "participante-unicode", {
      user_name: `Pessoa ÃÇ ${"muito ".repeat(80)}`,
    }),
  );

  await validateDatabaseEffects();
} catch (error) {
  fatalError = error;
  report.push({
    error: sanitizeError(error),
    operation: "webhook-smoke",
    status: "falha",
  });
} finally {
  await cleanupLocalZoomMeeting();
  console.log(JSON.stringify(report, null, 2));
  if (fatalError || report.some((entry) => entry.status === "falha")) {
    process.exit(1);
  }
}

function meetingEvent(event) {
  return {
    event,
    event_ts: Date.now(),
    payload: { object: { id: meetingId, uuid: meetingUuid } },
  };
}

function participantEvent(event, participantId, extra = {}) {
  return {
    event,
    event_ts: Date.now(),
    payload: {
      object: {
        id: meetingId,
        participant: {
          customer_key: `tes-${participantId}`,
          id: participantId,
          participant_uuid: `${participantId}-uuid`,
          user_id: `${participantId}-user`,
          ...extra,
        },
        uuid: meetingUuid,
      },
    },
  };
}

async function sendScenario(name, payload, options = {}) {
  await sendRawScenario(name, JSON.stringify(payload), options);
}

async function sendRawScenario(name, body, options = {}) {
  const started = Date.now();
  const timestamp =
    options.timestampOverride ?? Math.floor(Date.now() / 1000).toString();
  const signature =
    options.signatureOverride ??
    `v0=${crypto
      .createHmac("sha256", secret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex")}`;
  const headers = {
    "Content-Type": "application/json",
    "x-zm-request-id": options.duplicateRequestId ?? crypto.randomUUID(),
  };
  if (!options.omitTimestamp) headers["x-zm-request-timestamp"] = timestamp;
  if (!options.omitSignature) headers["x-zm-signature"] = signature;

  try {
    const response = await fetch(endpoint, {
      body,
      headers,
      method: "POST",
    });
    const payload = await response.json().catch(() => ({}));
    const expectedStatus = options.expectedStatus ?? 200;
    const bodyField = options.expectBodyField;
    report.push({
      durationMs: Date.now() - started,
      httpStatus: response.status,
      operation: name,
      status:
        response.status === expectedStatus &&
        (!bodyField || payload?.data?.[bodyField] === true)
          ? "sucesso"
          : "falha",
    });
  } catch (error) {
    report.push({
      durationMs: Date.now() - started,
      error: sanitizeError(error),
      operation: name,
      status: "falha",
    });
  }
}

async function validateDatabaseEffects() {
  if (!supabase || !localMeetingId) return;

  const [meeting] = await supabaseFetch(
    `/rest/v1/zoom_meetings?select=status,actual_started_at,actual_ended_at&id=eq.${encodeURIComponent(localMeetingId)}&limit=1`,
  );
  const participations = await supabaseFetch(
    `/rest/v1/zoom_meeting_participations?select=event_type&meeting_id=eq.${encodeURIComponent(localMeetingId)}`,
  );
  const webhookEvents = await supabaseFetch(
    `/rest/v1/zoom_webhook_events?select=processing_status&zoom_meeting_id=eq.${encodeURIComponent(meetingId)}`,
  );

  report.push({
    meetingEnded: meeting?.status === "ended",
    operation: "validate-db-effects",
    participationEvents: participations.length,
    status:
      meeting?.status === "ended" &&
      participations.length >= 4 &&
      webhookEvents.some((event) => event.processing_status === "ignored")
        ? "sucesso"
        : "falha",
    webhookEvents: webhookEvents.length,
  });
}

async function seedLocalZoomMeeting(status) {
  const bookings = await supabaseFetch(
    "/rest/v1/bookings?select=id,starts_at,ends_at,timezone,payment_status,status&payment_status=eq.paid&status=eq.confirmed&limit=20",
  );
  for (const booking of bookings) {
    const existing = await supabaseFetch(
      `/rest/v1/zoom_meetings?select=id&booking_id=eq.${encodeURIComponent(booking.id)}&limit=1`,
    );
    if (existing.length) continue;

    const created = await supabaseFetch("/rest/v1/zoom_meetings?select=id", {
      body: JSON.stringify({
        booking_id: booking.id,
        duration_minutes: 30,
        environment: process.env.ZOOM_ENVIRONMENT,
        metadata: { source: "zoom_webhook_smoke", test: true },
        provider: "zoom",
        scheduled_ends_at: booking.ends_at,
        scheduled_starts_at: booking.starts_at,
        status: status ?? "scheduled",
        timezone: booking.timezone ?? "America/Sao_Paulo",
        topic: `TES webhook smoke ${correlationId}`,
        zoom_host_user_id: "local-smoke-host",
        zoom_meeting_id: meetingId,
        zoom_meeting_uuid: meetingUuid,
      }),
      headers: { Prefer: "return=representation" },
      method: "POST",
    });

    return created[0]?.id ?? null;
  }

  throw new Error("zoom_webhook_smoke_booking_unavailable");
}

async function cleanupLocalZoomMeeting() {
  if (!supabase || !localMeetingId) return;

  await supabaseFetch(
    `/rest/v1/zoom_meeting_participations?meeting_id=eq.${encodeURIComponent(localMeetingId)}`,
    { method: "DELETE" },
  ).catch(() => null);
  await supabaseFetch(
    `/rest/v1/zoom_webhook_events?zoom_meeting_id=eq.${encodeURIComponent(meetingId)}`,
    { method: "DELETE" },
  ).catch(() => null);
  await supabaseFetch(
    `/rest/v1/zoom_meetings?id=eq.${encodeURIComponent(localMeetingId)}`,
    { method: "DELETE" },
  ).catch(() => null);
  report.push({
    cleanup: "sim",
    operation: "cleanup-local-webhook-smoke",
    status: "sucesso",
  });
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
  if (!response.ok) {
    throw new Error(
      `supabase_http_${response.status}:${text.replace(/[\r\n]+/g, " ").slice(0, 160)}`,
    );
  }

  return text ? JSON.parse(text) : [];
}
