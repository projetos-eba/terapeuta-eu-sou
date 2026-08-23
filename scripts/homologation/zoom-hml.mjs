import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { chromium, expect } from "@playwright/test";

import { loadEnvFiles } from "../payments/env-utils.mjs";
import { loadZoomVideoSdkEnv } from "../zoom/video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  endSessionByApi,
  listActiveSessions,
  maskIdentifier,
} from "../zoom/video-sdk-real-helpers.mjs";
import { createSupabaseAdmin } from "../zoom/video-sdk-real-supabase.mjs";

export const EXPECTED_HML_SUPABASE_REF = "emzwqkmrryuqvqiohqnu";
export const MIN_HML_DURATION_SECONDS = 30;
export const MAX_HML_DURATION_SECONDS = 60;
export const HML_JOIN_WINDOW_BEFORE_MINUTES = 15;
export const MAX_HML_JOIN_WINDOW_WAIT_SECONDS = 300;
export const PATIENT_JOIN_TRANSITION_TIMEOUT_MS = 45_000;
export const PATIENT_MANUAL_REFRESH_FALLBACK_TIMEOUT_MS = 10_000;
const REDACTED_EMAIL = "[redacted-email]";
const REDACTED_JWT = "[redacted-jwt]";
const REDACTED_SHARE = "[redacted-vercel-share]";
const REDACTED_UUID = "[redacted-uuid]";

export function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

export function readArg(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function isTruthyValue(value) {
  return /^(1|true|yes)$/i.test(String(value ?? "").trim());
}

export function resolveDurationSeconds({ argv, env }) {
  const raw =
    readArg(argv, "duration-seconds") ??
    env.ZOOM_HML_DURATION_SECONDS?.trim() ??
    "45";
  const parsed = Number(raw);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_HML_DURATION_SECONDS ||
    parsed > MAX_HML_DURATION_SECONDS
  ) {
    throw new Error(
      `duration_seconds_invalid:${MIN_HML_DURATION_SECONDS}-${MAX_HML_DURATION_SECONDS}`,
    );
  }
  return parsed;
}

export function resolveJoinWindowWaitMs({ nowMs = Date.now(), startsAt }) {
  const startsAtMs = Date.parse(startsAt);
  if (!Number.isFinite(startsAtMs)) {
    throw new Error("booking_starts_at_invalid");
  }

  const waitMs = startsAtMs - HML_JOIN_WINDOW_BEFORE_MINUTES * 60_000 - nowMs;
  if (waitMs <= 0) {
    throw new Error("booking_not_before_join_window");
  }
  if (waitMs > MAX_HML_JOIN_WINDOW_WAIT_SECONDS * 1000) {
    throw new Error("booking_too_far_from_join_window");
  }
  return waitMs;
}

export function extractSupabaseProjectRef(value) {
  try {
    const hostname = new URL(value).hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost") return null;
    const [ref] = hostname.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

export function resolveSharedBaseUrl(env) {
  const raw = env.ZOOM_HML_BASE_URL?.trim() || env.PLAYWRIGHT_BASE_URL?.trim();
  if (!raw) {
    throw new Error("shared_base_url_missing");
  }

  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("shared_base_url_requires_https");
  }
  if (!url.searchParams.get("_vercel_share")) {
    throw new Error("shared_base_url_requires_vercel_share");
  }
  return url.toString();
}

export function buildSharedUrl(baseUrl, target, extraSearchParams = {}) {
  const shared = new URL(baseUrl);
  const resolved = new URL(target, `${shared.origin}/`);
  const vercelShare = shared.searchParams.get("_vercel_share");
  if (!vercelShare) {
    throw new Error("shared_base_url_requires_vercel_share");
  }
  resolved.searchParams.set("_vercel_share", vercelShare);
  for (const [key, value] of Object.entries(extraSearchParams)) {
    if (value == null) continue;
    resolved.searchParams.set(key, String(value));
  }
  return resolved.toString();
}

export function parseNetscapeCookieJar(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .flatMap((rawLine) => {
      const httpOnly = rawLine.startsWith("#HttpOnly_");
      if (!rawLine || (rawLine.startsWith("#") && !httpOnly)) return [];

      const line = httpOnly ? rawLine.slice("#HttpOnly_".length) : rawLine;
      const [domain, , cookiePath, secure, expires, name, ...valueParts] =
        line.split("\t");
      if (!domain || !name || valueParts.length === 0) return [];

      const cookie = {
        domain,
        httpOnly,
        name,
        path: cookiePath || "/",
        secure: secure?.toUpperCase() === "TRUE",
        value: valueParts.join("\t"),
      };
      const expiresAt = Number(expires);
      if (Number.isFinite(expiresAt) && expiresAt > 0) {
        cookie.expires = expiresAt;
      }
      return [cookie];
    });
}

async function loadVercelCookies(filePath) {
  if (!filePath) return [];
  try {
    const cookies = parseNetscapeCookieJar(await readFile(filePath, "utf8"));
    if (cookies.length === 0) throw new Error("empty");
    return cookies;
  } catch {
    throw new Error("vercel_cookie_file_unreadable");
  }
}

export function sanitizeLog(value) {
  return String(value ?? "")
    .replace(/_vercel_share=[^&\s]+/gi, `_vercel_share=${REDACTED_SHARE}`)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED_EMAIL)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, REDACTED_JWT)
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      REDACTED_UUID,
    )
    .replace(
      /\b(?:whsec|sk_(?:test|live)|rk_(?:test|live)|sb_(?:publishable|secret)|service_role|anon)_[A-Za-z0-9_-]+\b/gi,
      "[redacted-secret]",
    )
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(
      /\b(authorization|apikey|api_key|token|secret|password|session_id|provider_session_id|code)=([^&\s]+)/gi,
      "$1=[redacted]",
    );
}

export function sanitizeUrlForEvidence(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (key === "_vercel_share") {
        url.searchParams.set(key, REDACTED_SHARE);
        continue;
      }
      if (
        /(token|secret|password|email|jwt|authorization|apikey|api_key|code|session|booking|payment|provider)/i.test(
          key,
        )
      ) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    url.pathname = url.pathname.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      REDACTED_UUID,
    );
    return sanitizeLog(url.toString());
  } catch {
    return sanitizeLog(value);
  }
}

export function sanitizeError(error) {
  const payload = {
    message: sanitizeLog(String(error?.message ?? error)).slice(0, 500),
    name: error?.name ?? "Error",
  };
  if (error?.details) {
    payload.details = sanitizeDetails(error.details);
  }
  return payload;
}

export function sanitizeDetails(value) {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeLog(value).slice(0, 8_000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeDetails);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, nested]) => [key, sanitizeDetails(nested)]),
    );
  }
  return sanitizeLog(String(value)).slice(0, 8_000);
}

function summarizeZoomAccessState(access) {
  if (!access || typeof access !== "object") return null;
  return {
    allowed: access.allowed === true,
    availableFrom:
      typeof access.availableFrom === "string" ? access.availableFrom : null,
    availableUntil:
      typeof access.availableUntil === "string" ? access.availableUntil : null,
    hardEndsAt:
      typeof access.hardEndsAt === "string" ? access.hardEndsAt : null,
    reason: typeof access.reason === "string" ? access.reason : null,
    serverNow: typeof access.serverNow === "string" ? access.serverNow : null,
    videoSessionStatus:
      typeof access.videoSessionStatus === "string"
        ? access.videoSessionStatus
        : null,
  };
}

function summarizeAccessRequestBody(request) {
  try {
    const body = request.postDataJSON?.();
    if (!body || typeof body !== "object") return null;
    return {
      actorRole: typeof body.actorRole === "string" ? body.actorRole : null,
      bookingId:
        typeof body.bookingId === "string"
          ? maskIdentifier(body.bookingId)
          : null,
      intent: typeof body.intent === "string" ? body.intent : null,
    };
  } catch {
    return null;
  }
}

export function summarizeAccessPayload(payload) {
  const data = payload?.data;
  const access =
    (data && typeof data === "object" ? data.access : null) ??
    (payload && typeof payload === "object" ? payload.access : null) ??
    null;

  return {
    access: summarizeZoomAccessState(access),
    error:
      typeof payload?.error?.message === "string"
        ? sanitizeLog(payload.error.message).slice(0, 240)
        : typeof payload?.message === "string"
          ? sanitizeLog(payload.message).slice(0, 240)
          : null,
    hasJoinPayload: Boolean(
      data &&
      typeof data === "object" &&
      ("token" in data || "sessionName" in data || "sdkKey" in data),
    ),
    ok: payload?.ok === true,
    roleType:
      data &&
      typeof data === "object" &&
      (data.roleType === 0 || data.roleType === 1)
        ? data.roleType
        : null,
  };
}

async function serializeConsoleArg(handle) {
  try {
    return sanitizeDetails(await handle.jsonValue());
  } catch {
    try {
      return sanitizeDetails(
        await handle.evaluate((value) => {
          if (Array.isArray(value)) return value;
          if (value && typeof value === "object") return value;
          return String(value);
        }),
      );
    } catch {
      return sanitizeLog(String(handle)).slice(0, 240);
    }
  }
}

async function serializeConsoleArgs(handles) {
  return Promise.all(handles.slice(0, 5).map(serializeConsoleArg));
}

function isAccessRequestUrl(value) {
  try {
    return new URL(value).pathname === "/api/zoom/video-session-access";
  } catch {
    return false;
  }
}

function recordAccessEvent(store, role, event) {
  store[role] ??= [];
  store[role].push({
    ...event,
    at: new Date().toISOString(),
  });
  if (store[role].length > 40) {
    store[role].splice(0, store[role].length - 40);
  }
}

async function buildAccessResponseEvent(response) {
  let payload = null;
  let parseError = null;
  try {
    payload = await response.json();
  } catch {
    parseError = "invalid_json";
  }

  return {
    kind: "access_response",
    method: response.request().method(),
    request: summarizeAccessRequestBody(response.request()),
    response: payload ? summarizeAccessPayload(payload) : null,
    responseParseError: parseError,
    status: response.status(),
    url: sanitizeUrlForEvidence(response.url()).slice(0, 500),
  };
}

export function summarizeBrowserEvents(browserEvents) {
  return Object.fromEntries(
    Object.entries(browserEvents ?? {}).map(([role, events]) => {
      const summary = {
        consoleLevels: {},
        counts: {},
        failedRequests: {},
        responseStatuses: {},
        samples: {
          console: [],
          network: [],
        },
      };

      for (const event of events ?? []) {
        summary.counts[event.kind] = (summary.counts[event.kind] ?? 0) + 1;

        if (event.kind === "console") {
          const level = event.level ?? "log";
          summary.consoleLevels[level] =
            (summary.consoleLevels[level] ?? 0) + 1;
          if (summary.samples.console.length < 5) {
            summary.samples.console.push({
              args: Array.isArray(event.args) ? event.args : [],
              level,
              text: event.text,
            });
          }
          continue;
        }

        if (event.kind === "pageerror") {
          if (summary.samples.console.length < 5) {
            summary.samples.console.push({
              level: "pageerror",
              text: event.text,
            });
          }
          continue;
        }

        if (event.kind === "response") {
          const status = String(event.status ?? "unknown");
          summary.responseStatuses[status] =
            (summary.responseStatuses[status] ?? 0) + 1;
        }

        if (event.kind === "requestfailed") {
          const failure = event.failure ?? "unknown";
          summary.failedRequests[failure] =
            (summary.failedRequests[failure] ?? 0) + 1;
        }

        if (summary.samples.network.length < 10) {
          summary.samples.network.push(
            event.kind === "requestfailed"
              ? {
                  failure: event.failure ?? null,
                  kind: event.kind,
                  method: event.method ?? null,
                  url: event.url ?? null,
                }
              : {
                  kind: event.kind,
                  method: event.method ?? null,
                  status: event.status ?? null,
                  url: event.url ?? null,
                },
          );
        }
      }

      return [role, summary];
    }),
  );
}

export function summarizeAccessRequests(accessRequests) {
  return Object.fromEntries(
    Object.entries(accessRequests ?? {}).map(([role, events]) => {
      const summary = {
        counts: {},
        intents: {},
        samples: [],
        statuses: {},
      };

      for (const event of events ?? []) {
        summary.counts[event.kind] = (summary.counts[event.kind] ?? 0) + 1;
        const intent = event.request?.intent ?? "unknown";
        summary.intents[intent] = (summary.intents[intent] ?? 0) + 1;
        const status = String(event.status ?? "unknown");
        summary.statuses[status] = (summary.statuses[status] ?? 0) + 1;
        if (summary.samples.length < 6) {
          summary.samples.push({
            kind: event.kind,
            request: event.request ?? null,
            response: event.response ?? null,
            status: event.status ?? null,
          });
        }
      }

      return [role, summary];
    }),
  );
}

export function resolveManualRefreshFallbackEnabled({ argv, env }) {
  return (
    hasFlag(argv, "allow-manual-refresh-fallback") ||
    isTruthyValue(env.ZOOM_HML_ALLOW_MANUAL_REFRESH_FALLBACK)
  );
}

export function createPatientJoinWaitPlan({
  allowManualRefreshFallback = false,
  manualRefreshFallbackTimeoutMs = PATIENT_MANUAL_REFRESH_FALLBACK_TIMEOUT_MS,
  timeoutMs = PATIENT_JOIN_TRANSITION_TIMEOUT_MS,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("patient_join_timeout_invalid");
  }

  const minimumAutomaticTimeoutMs = Math.min(
    5_000,
    Math.max(Math.round(timeoutMs / 2), 1),
  );
  const manualFallbackTimeoutClamped = allowManualRefreshFallback
    ? Math.min(
        manualRefreshFallbackTimeoutMs,
        Math.max(timeoutMs - minimumAutomaticTimeoutMs, 0),
      )
    : 0;

  return {
    automaticTimeoutMs: timeoutMs - manualFallbackTimeoutClamped,
    manualFallbackTimeoutMs: manualFallbackTimeoutClamped,
    timeoutMs,
  };
}

function recordUniqueObservation(observations, observation) {
  const prior = observations[observations.length - 1];
  if (
    prior?.kind === observation.kind &&
    prior?.control === observation.control &&
    prior?.text === observation.text
  ) {
    return;
  }

  observations.push({
    ...observation,
    at: new Date().toISOString(),
  });
  if (observations.length > 20) {
    observations.splice(0, observations.length - 20);
  }
}

function createPatientJoinTransitionError(code, observations) {
  const error = new Error(code);
  error.details = {
    lastObservation: observations[observations.length - 1] ?? null,
    observations,
  };
  return error;
}

export async function waitForPatientJoinTransition({
  allowManualRefreshFallback = false,
  intervalMs = 1_000,
  manualRefreshFallbackTimeoutMs = PATIENT_MANUAL_REFRESH_FALLBACK_TIMEOUT_MS,
  observe,
  timeoutMs = PATIENT_JOIN_TRANSITION_TIMEOUT_MS,
  triggerManualRefresh,
}) {
  if (typeof observe !== "function") {
    throw new Error("patient_join_observer_missing");
  }

  const plan = createPatientJoinWaitPlan({
    allowManualRefreshFallback,
    manualRefreshFallbackTimeoutMs,
    timeoutMs,
  });
  const observations = [];

  const remember = async () => {
    const observation = sanitizeDetails(await observe());
    if (!observation?.kind) {
      throw new Error("patient_join_observation_invalid");
    }
    recordUniqueObservation(observations, observation);
    return observation;
  };

  const waitForReady = async (budgetMs, errorCode) => {
    const ready = await poll({
      intervalMs,
      timeoutMs: budgetMs,
      task: async () => {
        const observation = await remember();
        return observation.kind === "join_ready" ? observation : null;
      },
    }).catch(() => null);

    if (ready) return ready;
    throw createPatientJoinTransitionError(errorCode, observations);
  };

  try {
    const finalObservation = await waitForReady(
      plan.automaticTimeoutMs,
      "patient_join_auto_transition_timeout",
    );
    return {
      finalObservation,
      mode: "automatic",
      observations,
      plan,
    };
  } catch (error) {
    if (!allowManualRefreshFallback) throw error;

    const lastObservation =
      observations[observations.length - 1] ?? (await remember());
    if (lastObservation.kind !== "manual_refresh_available") {
      throw createPatientJoinTransitionError(
        "patient_join_manual_refresh_unavailable",
        observations,
      );
    }
    if (typeof triggerManualRefresh !== "function") {
      throw createPatientJoinTransitionError(
        "patient_join_manual_refresh_handler_missing",
        observations,
      );
    }

    await triggerManualRefresh();
    const finalObservation = await waitForReady(
      plan.manualFallbackTimeoutMs,
      "patient_join_manual_refresh_timeout",
    );
    return {
      finalObservation,
      mode: "manual_refresh_fallback",
      observations,
      plan,
    };
  }
}

export function collectHarnessFailures({
  argv = [],
  env = process.env,
  staticZoomGateFailures = [],
} = {}) {
  const failures = [...staticZoomGateFailures];
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ZOOM_HML_PATIENT_EMAIL",
    "ZOOM_HML_THERAPIST_EMAIL",
    "ZOOM_HML_ADMIN_EMAIL",
  ];

  if (
    !argv.includes("--resolve-canonical-hml-fixture") &&
    !argv.includes("--prepare-canonical-hml-fixture")
  ) {
    required.push(
      "ZOOM_HML_BOOKING_ID",
      "ZOOM_HML_SESSION_PAYMENT_ID",
      "ZOOM_HML_VIDEO_SESSION_ID",
    );
  }

  if (!argv.includes("--use-admin-magic-link-sessions")) {
    required.push(
      "ZOOM_HML_PATIENT_PASSWORD",
      "ZOOM_HML_THERAPIST_PASSWORD",
      "ZOOM_HML_ADMIN_PASSWORD",
    );
  }

  for (const name of required) {
    if (!env[name]?.trim()) {
      failures.push({
        expected: "valor nao vazio no processo atual",
        item: name,
        where: "ambiente HML",
      });
    }
  }

  try {
    resolveSharedBaseUrl(env);
  } catch (error) {
    failures.push({
      expected: "URL https com query _vercel_share para HML",
      item: "PLAYWRIGHT_BASE_URL ou ZOOM_HML_BASE_URL",
      where: sanitizeLog(String(error?.message ?? error)),
    });
  }

  try {
    resolveDurationSeconds({ argv, env });
  } catch {
    failures.push({
      expected: `${MIN_HML_DURATION_SECONDS}-${MAX_HML_DURATION_SECONDS} segundos`,
      item: "ZOOM_HML_DURATION_SECONDS/--duration-seconds",
      where: "harness HML Zoom",
    });
  }

  const expectedRef =
    env.ZOOM_HML_SUPABASE_REF?.trim() || EXPECTED_HML_SUPABASE_REF;
  const actualRef = extractSupabaseProjectRef(env.SUPABASE_URL ?? "");
  if (actualRef !== expectedRef) {
    failures.push({
      expected: expectedRef,
      item: actualRef ?? "SUPABASE_URL",
      where: "Supabase HML remoto",
    });
  }

  if ((env.SUPABASE_URL ?? "").includes("127.0.0.1")) {
    failures.push({
      expected: "Supabase HML remoto, nunca local",
      item: "SUPABASE_URL",
      where: "harness HML Zoom",
    });
  }

  if (!argv.includes("--confirm-single-hml-session")) {
    failures.push({
      expected: "confirmacao humana momentanea para uma sessao HML curta",
      item: "--confirm-single-hml-session",
      where: "execucao do harness HML",
    });
  }

  if (!argv.includes("--confirm-hml-vercel-share")) {
    failures.push({
      expected: "confirmacao humana de URL compartilhada `_vercel_share` atual",
      item: "--confirm-hml-vercel-share",
      where: "execucao do harness HML",
    });
  }

  if (
    argv.includes("--resume-after-validated-join-window") &&
    !env.ZOOM_HML_RESUME_EVIDENCE_FILE?.trim()
  ) {
    failures.push({
      expected: "evidencia sanitizada da primeira execucao T-15",
      item: "ZOOM_HML_RESUME_EVIDENCE_FILE",
      where: "retomada HML Zoom",
    });
  }

  return failures;
}

function createConfig({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const baseUrl = resolveSharedBaseUrl(env);
  return {
    allowManualRefreshFallback: resolveManualRefreshFallbackEnabled({
      argv,
      env,
    }),
    adminEmail: env.ZOOM_HML_ADMIN_EMAIL.trim(),
    adminPassword: env.ZOOM_HML_ADMIN_PASSWORD?.trim() || null,
    authMode: argv.includes("--use-admin-magic-link-sessions")
      ? "admin_magic_link"
      : "password",
    baseUrl,
    bookingId: env.ZOOM_HML_BOOKING_ID?.trim() || null,
    durationSeconds: resolveDurationSeconds({ argv, env }),
    patientEmail: env.ZOOM_HML_PATIENT_EMAIL.trim(),
    patientPassword: env.ZOOM_HML_PATIENT_PASSWORD?.trim() || null,
    resumeEvidenceFile: env.ZOOM_HML_RESUME_EVIDENCE_FILE?.trim() || null,
    sessionPaymentId: env.ZOOM_HML_SESSION_PAYMENT_ID?.trim() || null,
    supabaseRuntime: {
      apiUrl: env.SUPABASE_URL.trim(),
      environment: "external",
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY.trim(),
    },
    therapistEmail: env.ZOOM_HML_THERAPIST_EMAIL.trim(),
    therapistPassword: env.ZOOM_HML_THERAPIST_PASSWORD?.trim() || null,
    vercelCookieFile: env.ZOOM_HML_VERCEL_COOKIE_FILE?.trim() || null,
    videoSessionId: env.ZOOM_HML_VIDEO_SESSION_ID?.trim() || null,
  };
}

export async function resolveCanonicalHmlFixture(
  admin,
  { patientEmail, therapistEmail },
) {
  const [patientUser] = await admin.select(
    "profiles",
    `select=id,role&email=eq.${encodeURIComponent(patientEmail)}&role=eq.patient&limit=1`,
  );
  const [therapistUser] = await admin.select(
    "profiles",
    `select=id,role&email=eq.${encodeURIComponent(therapistEmail)}&role=eq.therapist&limit=1`,
  );
  if (!patientUser?.id || !therapistUser?.id) {
    throw new Error("hml_fixture_profiles_missing");
  }

  const [patientProfile] = await admin.select(
    "patient_profiles",
    `select=id&user_id=eq.${encodeURIComponent(patientUser.id)}&limit=1`,
  );
  const [therapistProfile] = await admin.select(
    "therapist_profiles",
    `select=id&user_id=eq.${encodeURIComponent(therapistUser.id)}&limit=1`,
  );
  if (!patientProfile?.id || !therapistProfile?.id) {
    throw new Error("hml_fixture_domain_profiles_missing");
  }

  const rangeStart = new Date(Date.now() + 5_000).toISOString();
  const rangeEnd = new Date(
    Date.now() +
      (HML_JOIN_WINDOW_BEFORE_MINUTES * 60 + MAX_HML_JOIN_WINDOW_WAIT_SECONDS) *
        1000,
  ).toISOString();
  const bookings = await admin.select(
    "bookings",
    `select=id,starts_at&patient_profile_id=eq.${encodeURIComponent(
      patientProfile.id,
    )}&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfile.id,
    )}&status=eq.confirmed&payment_status=eq.paid&starts_at=gte.${encodeURIComponent(
      rangeStart,
    )}&starts_at=lte.${encodeURIComponent(rangeEnd)}&order=starts_at.asc&limit=10`,
  );

  for (const booking of bookings) {
    const [payment] = await admin.select(
      "session_payments",
      `select=id,stripe_checkout_session_id,financial_status&booking_id=eq.${encodeURIComponent(
        booking.id,
      )}&financial_status=eq.paid&limit=1`,
    );
    const [videoSession] = await admin.select(
      "video_sessions",
      `select=id,status,provider_session_id&booking_id=eq.${encodeURIComponent(
        booking.id,
      )}&status=eq.ready&provider_session_id=is.null&limit=1`,
    );
    const [stripeWebhook] = payment?.stripe_checkout_session_id
      ? await admin.select(
          "stripe_webhook_events",
          `select=stripe_event_id&object_id=eq.${encodeURIComponent(
            payment.stripe_checkout_session_id,
          )}&event_type=eq.checkout.session.completed&processing_status=eq.processed&limit=1`,
        )
      : [];
    if (payment?.id && videoSession?.id && stripeWebhook?.stripe_event_id) {
      return {
        bookingId: booking.id,
        sessionPaymentId: payment.id,
        videoSessionId: videoSession.id,
      };
    }
  }

  throw new Error("canonical_hml_fixture_not_found");
}

async function createCanonicalHmlFixture({ admin, config, evidence, logDir }) {
  const [patientUser] = await admin.select(
    "profiles",
    `select=id&email=eq.${encodeURIComponent(config.patientEmail)}&role=eq.patient&limit=1`,
  );
  const [therapistUser] = await admin.select(
    "profiles",
    `select=id&email=eq.${encodeURIComponent(config.therapistEmail)}&role=eq.therapist&limit=1`,
  );
  const [patientProfile] = patientUser?.id
    ? await admin.select(
        "patient_profiles",
        `select=id&user_id=eq.${encodeURIComponent(patientUser.id)}&limit=1`,
      )
    : [];
  const [therapistProfile] = therapistUser?.id
    ? await admin.select(
        "therapist_profiles",
        `select=id,slug&user_id=eq.${encodeURIComponent(therapistUser.id)}&limit=1`,
      )
    : [];
  if (!patientProfile?.id || !therapistProfile?.id) {
    throw new Error("hml_fixture_domain_profiles_missing");
  }

  const [service] = await admin.select(
    "therapist_services",
    `select=id,title,duration_minutes,price_cents&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfile.id,
    )}&status=eq.active&is_bookable=eq.true&online_only=eq.true&order=created_at.asc&limit=1`,
  );
  if (!service?.id) throw new Error("hml_fixture_bookable_service_missing");

  const [settings] = await admin.select(
    "therapist_service_booking_settings",
    `select=service_id,buffer_before_minutes,buffer_after_minutes,min_notice_minutes,max_days_ahead,interval_minutes&service_id=eq.${encodeURIComponent(
      service.id,
    )}&limit=1`,
  );
  if (!settings?.service_id) throw new Error("hml_fixture_settings_missing");

  let temporaryRuleId = null;
  const target = new Date(Date.now() + 17 * 60_000);
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    })
      .format(target)
      .replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (name) =>
        String(
          { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[name],
        ),
      ),
  );

  await admin.patch(
    "therapist_service_booking_settings",
    `service_id=eq.${encodeURIComponent(service.id)}`,
    {
      buffer_after_minutes: 0,
      buffer_before_minutes: 0,
      interval_minutes: 1,
      max_days_ahead: Math.max(settings.max_days_ahead ?? 1, 1),
      min_notice_minutes: 0,
    },
  );

  try {
    const insertedRules = await admin.insert("availability_rules", [
      {
        day_of_week: weekday,
        end_time: "23:59",
        is_active: true,
        service_id: service.id,
        start_time: "00:00",
        therapist_profile_id: therapistProfile.id,
        timezone: "America/Sao_Paulo",
      },
    ]);
    temporaryRuleId = insertedRules?.[0]?.id ?? null;

    const desiredSlotStart = new Date(Date.now() + 17 * 60_000);
    const desiredSlotEnd = new Date(Date.now() + 18 * 60_000);
    // The authoritative slot RPC only returns candidates whose full duration
    // fits inside p_range_end. Keep the desired start window narrow while
    // extending the query range enough to contain the complete meeting.
    const slotQueryEnd = new Date(
      desiredSlotEnd.getTime() + service.duration_minutes * 60_000,
    );
    const slots = await admin.rpc("get_service_available_slots_v1", {
      p_limit: 30,
      p_range_end: slotQueryEnd.toISOString(),
      p_range_start: desiredSlotStart.toISOString(),
      p_service_id: service.id,
    });
    const slot = slots?.slots?.find(
      (candidate) => Date.parse(candidate.startsAt) <= desiredSlotEnd.getTime(),
    );
    if (!slot?.startsAt) throw new Error("hml_fixture_slot_not_available");

    const browser = await chromium.launch({ headless: false, slowMo: 200 });
    const context = await browser.newContext();
    const page = await context.newPage();
    attachPageCapture(page, "fixture", evidence);
    try {
      await authenticateContextWithAdminSession({
        admin,
        baseUrl: config.baseUrl,
        context,
        email: config.patientEmail,
        role: "patient",
      });
      const params = new URLSearchParams({
        duration: String(service.duration_minutes),
        etapa: "preparar",
        price: String(service.price_cents),
        service: service.id,
        serviceName: service.title,
        slot: slot.startsAt,
        therapist: therapistProfile.slug,
      });
      await page.goto(
        buildSharedUrl(config.baseUrl, `/reserva?${params.toString()}`),
        { waitUntil: "domcontentloaded" },
      );
      const prepareForm = page.locator("form").filter({
        has: page.locator('input[name="terms"]'),
      });
      const terms = prepareForm.locator('input[name="terms"]');
      const advance = prepareForm.getByRole("button", {
        name: /Avan.ar para pagamento/i,
      });
      await expect(terms).toBeVisible({ timeout: 30_000 });
      await terms.check();
      await expect(terms).toBeChecked();
      await expect(advance).toBeEnabled({ timeout: 15_000 });
      await advance.click();
      await page.waitForURL(/etapa=pagamento/, { timeout: 30_000 });
      await page
        .locator("#reservation-embedded-checkout iframe")
        .first()
        .waitFor({ state: "attached", timeout: 90_000 });
      await completeHmlStripeCheckout(page, { logDir });

      const fixture = await waitForHmlCanonicalPayment(admin, {
        patientProfileId: patientProfile.id,
        serviceId: service.id,
      });
      await page.screenshot({
        path: path.join(logDir, "canonical-payment-confirmed.png"),
      });
      evidence.fixture = {
        bookingId: maskIdentifier(fixture.bookingId),
        canonicalStripeWebhook: true,
        renewable: true,
        sessionPaymentId: maskIdentifier(fixture.sessionPaymentId),
        videoSessionId: maskIdentifier(fixture.videoSessionId),
      };
      return fixture;
    } finally {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  } finally {
    if (temporaryRuleId) {
      await admin
        .delete(
          "availability_rules",
          `id=eq.${encodeURIComponent(temporaryRuleId)}`,
        )
        .catch(() => undefined);
    }
    await admin.patch(
      "therapist_service_booking_settings",
      `service_id=eq.${encodeURIComponent(service.id)}`,
      {
        buffer_after_minutes: settings.buffer_after_minutes,
        buffer_before_minutes: settings.buffer_before_minutes,
        interval_minutes: settings.interval_minutes,
        max_days_ahead: settings.max_days_ahead,
        min_notice_minutes: settings.min_notice_minutes,
      },
    );
  }
}

async function completeHmlStripeCheckout(page, { logDir }) {
  const fields = [
    {
      labels: /Card number|N.mero do cart.o/i,
      selectors: ['input[autocomplete="cc-number"]', 'input[name="number"]'],
      value: "4242424242424242",
    },
    {
      labels: /Expiration|Validade|MM\s*\/\s*(YY|AA)/i,
      selectors: ['input[autocomplete="cc-exp"]', 'input[name="expiry"]'],
      value: "1234",
    },
    {
      labels: /CVC|C.digo de seguran.a/i,
      selectors: ['input[autocomplete="cc-csc"]', 'input[name="cvc"]'],
      value: "123",
    },
    {
      labels:
        /Name on card|Cardholder name|Nome do titular do cart.o|Nome completo/i,
      selectors: ['input[autocomplete="cc-name"]', 'input[name="billingName"]'],
      value: "TES HML",
    },
  ];
  for (const field of fields) {
    const locator = await findHmlStripeLocator(
      page,
      field.labels,
      field.selectors,
    );
    if (!locator) throw new Error("stripe_checkout_field_missing");
    await locator.fill(field.value);
  }
  await page.screenshot({
    path: path.join(logDir, "stripe-checkout-filled.png"),
  });
  const submit = await findHmlStripeButton(page);
  if (!submit) throw new Error("stripe_checkout_submit_missing");
  await submit.evaluate((button) => button.click());
  await delay(5_000);
  await page
    .screenshot({ path: path.join(logDir, "stripe-checkout-submitted.png") })
    .catch(() => undefined);
}

async function findHmlStripeLocator(page, labels, selectors) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      for (const locator of [
        frame.getByLabel(labels).first(),
        ...selectors.map((selector) => frame.locator(selector).first()),
      ]) {
        if (
          (await locator.count().catch(() => 0)) > 0 &&
          (await locator.isVisible().catch(() => false))
        ) {
          return locator;
        }
      }
    }
    await delay(300);
  }
  return null;
}

async function findHmlStripeButton(page) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      const paymentButton = frame
        .getByRole("button", {
          name: /^(?:Pagar|Pay)(?:\s+(?:R\$|US\$|\$)|$)/i,
        })
        .first();
      if (
        (await paymentButton.count().catch(() => 0)) > 0 &&
        (await paymentButton.isVisible().catch(() => false)) &&
        (await paymentButton.isEnabled().catch(() => false))
      ) {
        return paymentButton;
      }

      const buttons = frame.locator('button[type="submit"]');
      const count = await buttons.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index);
        if (
          (await button.isVisible().catch(() => false)) &&
          (await button.isEnabled().catch(() => false))
        ) {
          return button;
        }
      }
    }
    await delay(300);
  }
  return null;
}

async function waitForHmlCanonicalPayment(
  admin,
  { patientProfileId, serviceId },
) {
  return poll({
    intervalMs: 2_000,
    timeoutMs: 150_000,
    task: async () => {
      const [booking] = await admin.select(
        "bookings",
        `select=id,status,payment_status&patient_profile_id=eq.${encodeURIComponent(
          patientProfileId,
        )}&service_id=eq.${encodeURIComponent(
          serviceId,
        )}&order=created_at.desc&limit=1`,
      );
      if (!booking?.id) return null;
      const [payment] = await admin.select(
        "session_payments",
        `select=id,financial_status,stripe_checkout_session_id&booking_id=eq.${encodeURIComponent(
          booking.id,
        )}&limit=1`,
      );
      const [videoSession] = await admin.select(
        "video_sessions",
        `select=id&booking_id=eq.${encodeURIComponent(booking.id)}&limit=1`,
      );
      const [webhook] = payment?.stripe_checkout_session_id
        ? await admin.select(
            "stripe_webhook_events",
            `select=stripe_event_id&object_id=eq.${encodeURIComponent(
              payment.stripe_checkout_session_id,
            )}&event_type=eq.checkout.session.completed&processing_status=eq.processed&limit=1`,
          )
        : [];
      if (
        booking.status === "confirmed" &&
        booking.payment_status === "paid" &&
        payment?.financial_status === "paid" &&
        videoSession?.id &&
        webhook?.stripe_event_id
      ) {
        return {
          bookingId: booking.id,
          sessionPaymentId: payment.id,
          videoSessionId: videoSession.id,
        };
      }
      return null;
    },
  });
}

function createEvidence(config) {
  const runId = `zoom-hml-${Date.now()}`;
  return {
    accessRequests: {},
    browserEvents: {},
    checks: [],
    config: {
      allowManualRefreshFallback: config.allowManualRefreshFallback,
      authMode: config.authMode,
      baseUrl: sanitizeUrlForEvidence(config.baseUrl),
      bookingId: maskIdentifier(config.bookingId),
      durationSeconds: config.durationSeconds,
      sessionPaymentId: maskIdentifier(config.sessionPaymentId),
      videoSessionId: maskIdentifier(config.videoSessionId),
    },
    createdAt: new Date().toISOString(),
    hml: true,
    phases: [],
    runId,
  };
}

function maskSessionRecord(record) {
  if (!record) return null;
  return {
    bookingId: record.bookingId ? maskIdentifier(record.bookingId) : null,
    paymentStatus: record.paymentStatus ?? null,
    providerSessionId: record.providerSessionId
      ? maskIdentifier(record.providerSessionId)
      : null,
    sessionPaymentId: record.sessionPaymentId
      ? maskIdentifier(record.sessionPaymentId)
      : null,
    status: record.status ?? null,
    videoSessionId: record.videoSessionId
      ? maskIdentifier(record.videoSessionId)
      : null,
  };
}

function recordBrowserEvent(store, role, event) {
  store[role] ??= [];
  store[role].push({
    ...event,
    at: new Date().toISOString(),
  });
  if (store[role].length > 120) {
    store[role].splice(0, store[role].length - 120);
  }
}

function attachPageCapture(page, role, evidence) {
  const browserEventStore = evidence.browserEvents;
  const accessRequestStore = evidence.accessRequests;

  page.on("console", async (message) =>
    recordBrowserEvent(browserEventStore, role, {
      args: await serializeConsoleArgs(message.args()),
      kind: "console",
      level: message.type(),
      text: sanitizeLog(message.text()).slice(0, 500),
    }),
  );
  page.on("pageerror", (error) =>
    recordBrowserEvent(browserEventStore, role, {
      kind: "pageerror",
      text: sanitizeLog(String(error?.message ?? error)).slice(0, 500),
    }),
  );
  page.on("requestfailed", (request) => {
    const event = {
      failure: sanitizeLog(request.failure()?.errorText ?? "").slice(0, 240),
      kind: "requestfailed",
      method: request.method(),
      url: sanitizeUrlForEvidence(request.url()).slice(0, 500),
    };
    recordBrowserEvent(browserEventStore, role, event);

    if (isAccessRequestUrl(request.url())) {
      recordAccessEvent(accessRequestStore, role, {
        kind: "access_request_failed",
        request: summarizeAccessRequestBody(request),
        status: null,
        url: event.url,
      });
    }
  });
  page.on("response", async (response) => {
    if (isAccessRequestUrl(response.url())) {
      recordAccessEvent(
        accessRequestStore,
        role,
        await buildAccessResponseEvent(response),
      );
    }

    const status = response.status();
    if (status < 400) return;
    recordBrowserEvent(browserEventStore, role, {
      kind: "response",
      method: response.request().method(),
      status,
      url: sanitizeUrlForEvidence(response.url()).slice(0, 500),
    });
  });
}

async function phase(evidence, name, callback) {
  evidence.currentPhase = name;
  evidence.phases.push({ at: new Date().toISOString(), phase: name });
  return callback();
}

async function writeEvidence(logDir, evidence) {
  const payload = {
    ...evidence,
    accessRequestSummary: summarizeAccessRequests(evidence.accessRequests),
    browserEventSummary: summarizeBrowserEvents(evidence.browserEvents),
  };
  await writeFile(
    path.join(logDir, "evidence.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function loginWithSharedRedirect(
  page,
  { baseUrl, buttonName, credentials, endpoint, loginPath, successPathPattern },
) {
  await page.goto(buildSharedUrl(baseUrl, loginPath), {
    waitUntil: "domcontentloaded",
  });
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  const result = await page.evaluate(
    async ({ buttonName: ignoredButtonName, endpoint: loginEndpoint }) => {
      const form = document.querySelector("form");
      if (!form) return { ok: false, message: "missing_form", status: 0 };

      const formData = new FormData(form);
      const response = await fetch(loginEndpoint, {
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response
        .json()
        .catch(() => ({ message: "invalid_json", ok: false }));

      if (!response.ok || !data?.ok || typeof data.redirectTo !== "string") {
        return {
          message:
            typeof data?.message === "string" ? data.message : "login_failed",
          ok: false,
          status: response.status,
        };
      }

      return {
        buttonName: ignoredButtonName,
        ok: true,
        redirectTo: data.redirectTo,
        status: response.status,
      };
    },
    { buttonName, endpoint },
  );

  if (!result.ok) {
    throw new Error(
      `login_failed:${endpoint}:${result.status}:${result.message}`,
    );
  }

  await page.goto(buildSharedUrl(baseUrl, result.redirectTo), {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(successPathPattern, { timeout: 30_000 });
}

async function authenticateContextWithAdminSession({
  admin,
  baseUrl,
  context,
  email,
  role,
}) {
  const session = await admin.authCreateSessionForEmail(email);
  const [profile] = await admin.select(
    "profiles",
    `select=id,role&id=eq.${encodeURIComponent(session.userId)}&limit=1`,
  );
  if (profile?.role !== role) throw new Error(`auth_role_mismatch:${role}`);

  const cookies = [
    {
      name: `tes_${role === "patient" ? "patient" : role}_access_token`,
      value: session.accessToken,
      maxAge: session.expiresIn,
    },
    {
      name: `tes_${role === "patient" ? "patient" : role}_refresh_token`,
      value: session.refreshToken,
      maxAge: 60 * 60 * 24 * 30,
    },
  ];

  if (role === "therapist") {
    const [therapist] = await admin.select(
      "therapist_profiles",
      `select=plan&user_id=eq.${encodeURIComponent(session.userId)}&limit=1`,
    );
    if (!therapist?.plan) throw new Error("therapist_profile_missing");
    cookies.push({
      maxAge: 60 * 60 * 24 * 30,
      name: "tes_therapist_plan",
      value: therapist.plan,
    });
  }

  const origin = new URL(baseUrl).origin;
  await context.addCookies(
    cookies.map((cookie) => ({
      httpOnly: true,
      name: cookie.name,
      sameSite: "Lax",
      secure: true,
      url: origin,
      value: cookie.value,
    })),
  );
}

async function assertContextHasNoAuth(context, label) {
  const cookies = await context.cookies();
  const inherited = cookies.find((cookie) =>
    /sb-|supabase|auth/i.test(cookie.name),
  );
  if (inherited) {
    throw new Error(`auth_cookie_leak:${label}:${inherited.name}`);
  }
}

async function poll({ intervalMs, task, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await task();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw lastError ?? new Error("poll_timeout");
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readSessionState(admin, config) {
  const [booking] = await admin.select(
    "bookings",
    `select=id,status,payment_status,starts_at,ends_at,timezone&id=eq.${encodeURIComponent(
      config.bookingId,
    )}&limit=1`,
  );
  const [payment] = await admin.select(
    "session_payments",
    `select=id,booking_id,financial_status,stripe_checkout_session_id,paid_at&id=eq.${encodeURIComponent(
      config.sessionPaymentId,
    )}&booking_id=eq.${encodeURIComponent(config.bookingId)}&limit=1`,
  );
  const [videoSession] = await admin.select(
    "video_sessions",
    `select=id,booking_id,status,session_name,session_key,provider_session_id,actual_started_at,actual_ended_at,therapist_present,therapist_first_joined_at,hard_ends_at&id=eq.${encodeURIComponent(
      config.videoSessionId,
    )}&booking_id=eq.${encodeURIComponent(config.bookingId)}&limit=1`,
  );

  return {
    booking,
    payment,
    videoSession,
  };
}

async function assertRemotePreflight(admin, config, evidence) {
  const state = await readSessionState(admin, config);
  const failures = [];

  if (!state.booking?.id) {
    failures.push({
      expected: "booking HML preexistente e acessivel",
      item: "ZOOM_HML_BOOKING_ID",
      where: "bookings",
    });
  }
  if (state.booking?.status !== "confirmed") {
    failures.push({
      expected: "booking confirmada",
      item: state.booking?.status ?? "booking_missing",
      where: "bookings.status",
    });
  }
  if (state.booking?.payment_status !== "paid") {
    failures.push({
      expected: "booking paga pela fonte canonica",
      item: state.booking?.payment_status ?? "booking_missing",
      where: "bookings.payment_status",
    });
  }
  if (!state.payment?.id) {
    failures.push({
      expected: "session_payment HML existente para a booking",
      item: "ZOOM_HML_SESSION_PAYMENT_ID",
      where: "session_payments",
    });
  }
  if (state.payment?.financial_status !== "paid") {
    failures.push({
      expected: "session_payments.financial_status = paid",
      item: state.payment?.financial_status ?? "payment_missing",
      where: "session_payments.financial_status",
    });
  }
  if (!state.videoSession?.id) {
    failures.push({
      expected: "video_session HML existente para a booking",
      item: "ZOOM_HML_VIDEO_SESSION_ID",
      where: "video_sessions",
    });
  }
  if (
    state.videoSession?.status &&
    ["ended", "canceled", "cancelled"].includes(state.videoSession.status)
  ) {
    failures.push({
      expected: "video_session ainda nao encerrada",
      item: state.videoSession.status,
      where: "video_sessions.status",
    });
  }
  if (state.videoSession?.provider_session_id) {
    failures.push({
      expected: "provider_session_id nulo antes da entrada HML",
      item: maskIdentifier(state.videoSession.provider_session_id),
      where: "video_sessions.provider_session_id",
    });
  }
  if (!state.videoSession?.session_name) {
    failures.push({
      expected: "session_name opaco ja provisionado para a booking paga",
      item: "video_sessions.session_name",
      where: "video_sessions",
    });
  }

  if (!evidence.resume) {
    const startsAtMs = Date.parse(state.booking?.starts_at ?? "");
    const millisecondsUntilStart = startsAtMs - Date.now();
    try {
      if (!Number.isFinite(startsAtMs) || millisecondsUntilStart <= 0) {
        throw new Error("booking_starts_at_invalid_or_elapsed");
      }
      if (
        millisecondsUntilStart >
        (HML_JOIN_WINDOW_BEFORE_MINUTES * 60 +
          MAX_HML_JOIN_WINDOW_WAIT_SECONDS) *
          1000
      ) {
        throw new Error("booking_too_far_from_join_window");
      }
    } catch (error) {
      failures.push({
        expected: `reserva entre ${HML_JOIN_WINDOW_BEFORE_MINUTES} e ${HML_JOIN_WINDOW_BEFORE_MINUTES + MAX_HML_JOIN_WINDOW_WAIT_SECONDS / 60} minutos antes do início`,
        item: "bookings.starts_at",
        where: sanitizeLog(String(error?.message ?? error)),
      });
    }
  } else if (Date.parse(state.booking?.starts_at ?? "") <= Date.now()) {
    failures.push({
      expected: "reserva ainda nao iniciada na retomada",
      item: "bookings.starts_at",
      where: "retomada HML Zoom",
    });
  }

  evidence.preflight = {
    booking: maskSessionRecord({
      bookingId: state.booking?.id,
      paymentStatus: state.booking?.payment_status,
      status: state.booking?.status,
    }),
    sessionPayment: maskSessionRecord({
      bookingId: state.payment?.booking_id,
      paymentStatus: state.payment?.financial_status,
      sessionPaymentId: state.payment?.id,
    }),
    videoSession: maskSessionRecord({
      bookingId: state.videoSession?.booking_id,
      providerSessionId: state.videoSession?.provider_session_id,
      status: state.videoSession?.status,
      videoSessionId: state.videoSession?.id,
    }),
  };

  if (failures.length > 0) {
    const error = new Error("hml_preflight_failed");
    error.details = failures;
    throw error;
  }

  return state;
}

async function assertNoRemoteActiveSessions(videoSession) {
  const sessions = await listActiveSessions();
  if (!sessions.ok) {
    throw new Error(`zoom_api_http_${sessions.status}`);
  }
  const active = sessions.activeSessions ?? [];
  const matching = active.filter((session) => {
    const sessionName = String(
      session.session_name ?? session.sessionName ?? "",
    );
    return sessionName === videoSession.session_name;
  });
  if (active.length > 0 || matching.length > 0) {
    const error = new Error("zoom_active_session_already_open");
    error.details = {
      activeSessionCount: active.length,
      matchingSessionCount: matching.length,
      sessions: active.map((session) => ({
        id: maskIdentifier(String(session.id ?? session.session_id ?? "")),
        status: String(session.status ?? "unknown"),
      })),
    };
    throw error;
  }
}

async function captureProviderSessionId(videoSession) {
  const session = await poll({
    intervalMs: 2_000,
    timeoutMs: 30_000,
    task: async () => {
      const response = await listActiveSessions({
        sessionName: videoSession.session_name,
      });
      if (!response.ok) {
        throw new Error(`zoom_active_sessions_http_${response.status}`);
      }
      const active = response.activeSessions ?? [];
      if (active.length === 1) return active[0];
      return null;
    },
  });

  const providerSessionId = String(session.id ?? session.session_id ?? "");
  if (!providerSessionId) {
    throw new Error("provider_session_id_not_captured");
  }
  return providerSessionId;
}

async function waitForTherapistPresence(admin, config) {
  await poll({
    intervalMs: 2_000,
    timeoutMs: 45_000,
    task: async () => {
      const state = await readSessionState(admin, config);
      if (
        state.videoSession?.status === "active" &&
        state.videoSession.provider_session_id &&
        state.videoSession.therapist_first_joined_at &&
        state.videoSession.therapist_present === true &&
        state.videoSession.hard_ends_at
      ) {
        return state;
      }
      return null;
    },
  });
}

async function waitForParticipantJoinEvidence(admin, config) {
  return poll({
    intervalMs: 2_000,
    timeoutMs: 45_000,
    task: async () => {
      const participations = await admin.select(
        "video_session_participations",
        `select=participant_role,event_type,joined_at,left_at&booking_id=eq.${encodeURIComponent(
          config.bookingId,
        )}`,
      );
      const joined = new Set(
        participations
          .filter(
            (participation) =>
              participation.event_type === "session.user_joined" &&
              participation.joined_at,
          )
          .map((participation) => participation.participant_role),
      );
      if (joined.has("therapist") && joined.has("patient")) {
        return participations;
      }
      return null;
    },
  });
}

async function waitForEndedEvidence(admin, config, providerSessionId) {
  return poll({
    intervalMs: 2_000,
    timeoutMs: 60_000,
    task: async () => {
      const state = await readSessionState(admin, config);
      const events = await admin.select(
        "zoom_video_webhook_events",
        `select=event_type,processing_status&provider_session_id=eq.${encodeURIComponent(
          providerSessionId,
        )}&processing_status=eq.processed`,
      );
      const participations = await admin.select(
        "video_session_participations",
        `select=participant_role,event_type,left_at&booking_id=eq.${encodeURIComponent(
          config.bookingId,
        )}`,
      );
      const eventTypes = new Set(events.map((event) => event.event_type));
      const rolesLeft = new Set(
        participations
          .filter(
            (participation) =>
              participation.event_type === "session.user_left" &&
              participation.left_at,
          )
          .map((participation) => participation.participant_role),
      );

      if (
        state.videoSession?.status === "ended" &&
        state.videoSession.actual_started_at &&
        state.videoSession.actual_ended_at &&
        eventTypes.has("session.started") &&
        eventTypes.has("session.ended") &&
        eventTypes.has("session.user_joined") &&
        eventTypes.has("session.user_left") &&
        rolesLeft.has("therapist") &&
        rolesLeft.has("patient")
      ) {
        return { events, participations, state };
      }
      return null;
    },
  });
}

async function assertSafeShell(page, role) {
  const bodyText = await page.locator("body").innerText();
  if (
    /meeting_url|provider_session_id|documents_metadata|diagnostic_context|eyJ/i.test(
      bodyText,
    )
  ) {
    throw new Error(`unsafe_shell_output:${role}`);
  }
}

async function assertPatientWaiting(page) {
  await expect(page.getByLabel("Sala de video")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator("body").innerText();
        return (
          /Aguardando o terapeuta iniciar o encontro|Aguardando terapeuta|A sala ainda n.o abriu|Aguardando participante|Sala indispon.vel/i.test(
            bodyText,
          ) &&
          (await page
            .getByRole("button", { name: "Entrar no encontro" })
            .count()) === 0
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function assertPatientBeforeJoinWindow(page) {
  await expect(
    page.getByRole("button", { name: "Entrar no encontro" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Dispon.vel 15 min antes/i }),
  ).toBeDisabled({ timeout: 30_000 });
}

async function exerciseParticipantControls(page) {
  await exerciseToggle(page, "Silenciar", "Ativar audio");
}

async function exerciseToggle(page, firstLabel, secondLabel) {
  const first = page.getByRole("button", { name: firstLabel });
  const second = page.getByRole("button", { name: secondLabel });
  if (await first.count()) {
    await first.click();
    await expect(second).toBeVisible({ timeout: 15_000 });
    await second.click();
    await expect(first).toBeVisible({ timeout: 15_000 });
    return;
  }
  if (await second.count()) {
    await second.click();
    await expect(first).toBeVisible({ timeout: 15_000 });
    await first.click();
    await expect(second).toBeVisible({ timeout: 15_000 });
    return;
  }
  throw new Error(`control_not_found:${firstLabel}:${secondLabel}`);
}

async function setChromiumMediaPermissions(page, granted) {
  const origin = new URL(page.url()).origin;
  if (granted) {
    await page.context().grantPermissions(["camera", "microphone"], { origin });
    return;
  }

  await page.context().clearPermissions();
  const session = await page.context().newCDPSession(page);
  try {
    const { targetInfo } = await session.send("Target.getTargetInfo");
    await session.send("Browser.grantPermissions", {
      browserContextId: targetInfo.browserContextId,
      origin,
      permissions: [],
    });
  } finally {
    await session.detach().catch(() => undefined);
  }
}

async function validatePatientPermissionRecovery(page) {
  await setChromiumMediaPermissions(page, false);
  const denied = await probeBrowserMedia(page);
  if (denied.outcome !== "rejected" || denied.errorName !== "NotAllowedError") {
    throw new Error(`media_permission_denial_failed:${denied.outcome}`);
  }

  await setChromiumMediaPermissions(page, true);
  const granted = await probeBrowserMedia(page);
  if (granted.outcome !== "resolved") {
    throw new Error(`media_permission_recovery_failed:${granted.outcome}`);
  }
}

async function probeBrowserMedia(page) {
  return page.evaluate(async () => {
    const timeout = new Promise((resolve) =>
      window.setTimeout(() => resolve({ outcome: "timeout" }), 5_000),
    );
    const media = navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        return { outcome: "resolved" };
      })
      .catch((error) => ({
        errorName: error instanceof DOMException ? error.name : "unknown",
        outcome: "rejected",
      }));
    return Promise.race([media, timeout]);
  });
}

async function setCamera(page, enabled) {
  const button = page.getByRole("button", {
    name: enabled ? "Ativar camera" : "Desligar camera",
  });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  await expect(
    page.getByRole("button", {
      name: enabled ? "Desligar camera" : "Ativar camera",
    }),
  ).toBeVisible({ timeout: 20_000 });
}

async function assertAttachedVideo(page, testId) {
  const stage = page.getByTestId(testId);
  await expect(stage.locator("video-player")).toHaveCount(1, {
    timeout: 30_000,
  });
  const size = await stage.locator("video-player").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  });
  if (size.width < 1 || size.height < 1) {
    throw new Error(`video_not_visible:${testId}`);
  }
}

async function validateBidirectionalCamera({ patientPage, therapistPage }) {
  await expect(
    patientPage.getByRole("button", { name: "Ativar camera" }),
  ).toBeVisible();
  await expect(
    therapistPage.getByRole("button", { name: "Ativar camera" }),
  ).toBeVisible();

  await setCamera(patientPage, true);
  await assertAttachedVideo(patientPage, "zoom-local-video");
  await assertAttachedVideo(therapistPage, "zoom-remote-video");

  await setCamera(therapistPage, true);
  await assertAttachedVideo(therapistPage, "zoom-local-video");
  await assertAttachedVideo(patientPage, "zoom-remote-video");

  await setCamera(patientPage, false);
  await setCamera(therapistPage, false);
}

async function captureResponsiveCallEvidence(page, logDir, evidence) {
  const viewports = [
    { height: 900, label: "desktop", width: 1440 },
    { height: 900, label: "tablet", width: 900 },
    { height: 844, label: "mobile", width: 390 },
    { height: 667, label: "mobile-short", width: 390 },
  ];
  evidence.responsive = [];

  for (const viewport of viewports) {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await delay(250);
    const metrics = await page.evaluate(() => {
      const criticalNames = ["Ativar audio", "Ativar camera", "Sair"];
      const buttons = [...document.querySelectorAll("button")]
        .filter((button) =>
          criticalNames.includes(button.textContent?.trim() ?? ""),
        )
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            bottom: Math.round(rect.bottom),
            name: button.textContent?.trim() ?? "",
            top: Math.round(rect.top),
          };
        });
      return {
        buttons,
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    const controlsFit = metrics.buttons.every(
      (button) => button.top >= 0 && button.bottom <= metrics.viewportHeight,
    );
    const noPageOverflow =
      metrics.documentWidth <= metrics.viewportWidth + 1 &&
      metrics.documentHeight <= metrics.viewportHeight + 1;
    evidence.responsive.push({
      controlsFit,
      label: viewport.label,
      noPageOverflow,
      viewport: `${viewport.width}x${viewport.height}`,
    });
    await page.screenshot({
      path: path.join(logDir, `call-${viewport.label}.png`),
    });
    if (!controlsFit || !noPageOverflow) {
      const error = new Error(`responsive_call_failed:${viewport.label}`);
      error.details = { metrics };
      throw error;
    }
  }
}

async function assertAdminDetail(page) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Detalhes da sessão" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Participantes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agenda da sessão" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Situação atual" }),
  ).toBeVisible();
}

async function assertPatientClosedState(page) {
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator("body").innerText();
        return (
          !/Entrando\.\.\./i.test(bodyText) &&
          (await page
            .getByRole("button", { name: "Entrar no encontro" })
            .count()) === 0 &&
          /encerrad|Sala indispon.vel|A sala ainda n.o abriu|Aguardando o terapeuta iniciar/i.test(
            bodyText,
          )
        );
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

async function observePatientJoinState(page) {
  const joinButton = page.getByRole("button", { name: "Entrar no encontro" });
  if ((await joinButton.count()) > 0) {
    return {
      control: "Entrar no encontro",
      kind: (await joinButton.isEnabled()) ? "join_ready" : "join_disabled",
    };
  }

  const refreshButton = page.getByRole("button", { name: "Atualizar sala" });
  if ((await refreshButton.count()) > 0) {
    return {
      control: "Atualizar sala",
      kind: (await refreshButton.isEnabled())
        ? "manual_refresh_available"
        : "auto_refresh_loading",
    };
  }

  const roomLocator = page.locator(
    "section[aria-label='Sala de video'], section[aria-label='Sala de espera']",
  );
  const rawText =
    ((await roomLocator.first().count()) > 0
      ? await roomLocator.first().innerText()
      : await page.locator("body").innerText()) ?? "";
  const text = sanitizeLog(rawText).slice(0, 500);

  if (
    /Aguardando o terapeuta iniciar o encontro|Aguardando terapeuta/i.test(
      rawText,
    )
  ) {
    return { kind: "waiting_for_therapist", text };
  }

  if (
    /Verificando sala|O terapeuta iniciou o encontro\. Voce ja pode entrar\./i.test(
      rawText,
    )
  ) {
    return { kind: "transitioning", text };
  }

  return { kind: "unknown", text };
}

async function assertTherapistClosedState(page) {
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator("body").innerText();
        return (
          (await page
            .getByRole("button", { name: "Encerrar encontro" })
            .count()) === 0 &&
          /encerrad|Segurança da sala|Operação da sessão/i.test(bodyText)
        );
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

async function runFlow({ admin, config, evidence, logDir }) {
  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream"],
    headless: false,
    slowMo: 200,
  });
  const patientBrowser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--deny-permission-prompts"],
    headless: false,
    slowMo: 200,
  });

  const adminContext = await browser.newContext();
  const patientContext = await patientBrowser.newContext();
  const therapistContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const vercelCookies = await loadVercelCookies(config.vercelCookieFile);
  if (vercelCookies.length > 0) {
    await Promise.all([
      adminContext.addCookies(vercelCookies),
      patientContext.addCookies(vercelCookies),
      therapistContext.addCookies(vercelCookies),
    ]);
  }
  const pages = {
    admin: await adminContext.newPage(),
    patient: await patientContext.newPage(),
    therapist: await therapistContext.newPage(),
  };

  for (const [role, page] of Object.entries(pages)) {
    attachPageCapture(page, role, evidence);
  }

  let providerSessionId = null;
  let sessionSnapshot = null;

  try {
    sessionSnapshot = await phase(evidence, "remote_preflight", () =>
      assertRemotePreflight(admin, config, evidence),
    );
    await phase(evidence, "zoom_active_session_preflight", () =>
      assertNoRemoteActiveSessions(sessionSnapshot.videoSession),
    );

    await phase(evidence, "therapist_login", async () => {
      if (config.authMode === "admin_magic_link") {
        await authenticateContextWithAdminSession({
          admin,
          baseUrl: config.baseUrl,
          context: therapistContext,
          email: config.therapistEmail,
          role: "therapist",
        });
        await pages.therapist.goto(
          buildSharedUrl(config.baseUrl, "/terapeuta"),
          {
            waitUntil: "domcontentloaded",
          },
        );
        await expect(pages.therapist).toHaveURL(/\/terapeuta(?:\?.*)?$/, {
          timeout: 30_000,
        });
        return;
      }
      await loginWithSharedRedirect(pages.therapist, {
        baseUrl: config.baseUrl,
        buttonName: "Entrar como terapeuta",
        credentials: {
          email: config.therapistEmail,
          password: config.therapistPassword,
        },
        endpoint: "/api/auth/therapist/login",
        loginPath: "/terapeuta/login",
        successPathPattern: /\/terapeuta(?:\?.*)?$/,
      });
    });
    await phase(evidence, "context_isolation_after_therapist", async () => {
      await assertContextHasNoAuth(patientContext, "patient_after_therapist");
      await assertContextHasNoAuth(adminContext, "admin_after_therapist");
    });

    await phase(evidence, "patient_login", async () => {
      if (config.authMode === "admin_magic_link") {
        await authenticateContextWithAdminSession({
          admin,
          baseUrl: config.baseUrl,
          context: patientContext,
          email: config.patientEmail,
          role: "patient",
        });
        await pages.patient.goto(buildSharedUrl(config.baseUrl, "/app"), {
          waitUntil: "domcontentloaded",
        });
        await expect(pages.patient).toHaveURL(/\/app(?:\?.*)?$/, {
          timeout: 30_000,
        });
        return;
      }
      await loginWithSharedRedirect(pages.patient, {
        baseUrl: config.baseUrl,
        buttonName: "Entrar",
        credentials: {
          email: config.patientEmail,
          password: config.patientPassword,
        },
        endpoint: "/api/auth/client/login",
        loginPath: "/cliente/login",
        successPathPattern: /\/app(?:\?.*)?$/,
      });
    });
    await phase(evidence, "context_isolation_after_patient", () =>
      assertContextHasNoAuth(adminContext, "admin_after_patient"),
    );

    await phase(evidence, "admin_login", async () => {
      if (config.authMode === "admin_magic_link") {
        await authenticateContextWithAdminSession({
          admin,
          baseUrl: config.baseUrl,
          context: adminContext,
          email: config.adminEmail,
          role: "admin",
        });
        await pages.admin.goto(buildSharedUrl(config.baseUrl, "/admin"), {
          waitUntil: "domcontentloaded",
        });
        await expect(pages.admin).toHaveURL(
          /\/admin(?:\/terapias)?(?:\?.*)?$/,
          {
            timeout: 30_000,
          },
        );
        return;
      }
      await loginWithSharedRedirect(pages.admin, {
        baseUrl: config.baseUrl,
        buttonName: "Entrar no Admin",
        credentials: {
          email: config.adminEmail,
          password: config.adminPassword,
        },
        endpoint: "/api/auth/admin/login",
        loginPath: "/admin-login",
        successPathPattern: /\/admin(?:\/terapias)?(?:\?.*)?$/,
      });
    });

    if (!evidence.resume) {
      const joinWindowWaitMs =
        Date.parse(sessionSnapshot.booking.starts_at) -
        HML_JOIN_WINDOW_BEFORE_MINUTES * 60_000 -
        Date.now();
      if (joinWindowWaitMs > 0) {
        await phase(evidence, "patient_before_join_window", async () => {
          await pages.patient.goto(
            buildSharedUrl(
              config.baseUrl,
              `/app/encontros/${config.bookingId}/video`,
            ),
            { waitUntil: "domcontentloaded" },
          );
          await assertPatientBeforeJoinWindow(pages.patient);
          await assertSafeShell(pages.patient, "patient_before_join_window");
          evidence.joinWindow = {
            opensBeforeMinutes: HML_JOIN_WINDOW_BEFORE_MINUTES,
            waitSeconds: Math.ceil(joinWindowWaitMs / 1000),
          };
        });

        await phase(evidence, "wait_for_join_window", () =>
          delay(joinWindowWaitMs + 1_500),
        );
      } else {
        evidence.joinWindow = {
          alreadyOpenAtRunStart: true,
          opensBeforeMinutes: HML_JOIN_WINDOW_BEFORE_MINUTES,
        };
      }
    } else {
      evidence.joinWindow = {
        opensBeforeMinutes: HML_JOIN_WINDOW_BEFORE_MINUTES,
        resumedFrom: evidence.resume.runId,
        validatedPreviously: true,
      };
    }

    await phase(evidence, "patient_waiting_room", async () => {
      await pages.patient.goto(
        buildSharedUrl(
          config.baseUrl,
          `/app/encontros/${config.bookingId}/video`,
        ),
        {
          waitUntil: "domcontentloaded",
        },
      );
      await assertPatientWaiting(pages.patient);
      await assertSafeShell(pages.patient, "patient_waiting");
    });

    await phase(evidence, "patient_permission_recovery", async () => {
      await validatePatientPermissionRecovery(pages.patient);
      evidence.mediaPermissions = {
        deniedThenGranted: true,
        patient: true,
      };
    });

    await phase(evidence, "admin_session_detail_prejoin", async () => {
      await pages.admin.goto(
        buildSharedUrl(config.baseUrl, `/admin/sessoes/${config.bookingId}`),
        {
          waitUntil: "domcontentloaded",
        },
      );
      await assertAdminDetail(pages.admin);
      await assertSafeShell(pages.admin, "admin_prejoin");
    });

    await phase(evidence, "therapist_join", async () => {
      await pages.therapist.goto(
        buildSharedUrl(
          config.baseUrl,
          `/terapeuta/sessoes/${config.bookingId}`,
        ),
        {
          waitUntil: "domcontentloaded",
        },
      );
      const therapistRoomLink = pages.therapist.locator(
        `a[href="/terapeuta/sessoes/${config.bookingId}/video"]`,
      );
      await expect(therapistRoomLink.first()).toBeVisible({ timeout: 30_000 });
      await therapistRoomLink.first().click();
      await expect(pages.therapist).toHaveURL(
        new RegExp(`/terapeuta/sessoes/${config.bookingId}/video`),
        { timeout: 30_000 },
      );
      const joinButton = pages.therapist.getByRole("button", {
        name: /Entrar no encontro|Entrar na sess.o/i,
      });
      await expect(joinButton).toBeVisible({ timeout: 120_000 });
      await joinButton.click();
      await expect(
        pages.therapist.getByText(
          /Voce entrou como responsavel pelo encontro\./i,
        ),
      ).toBeVisible({ timeout: 45_000 });
      await assertSafeShell(pages.therapist, "therapist_joined");
    });

    providerSessionId = await phase(evidence, "provider_session_capture", () =>
      captureProviderSessionId(sessionSnapshot.videoSession),
    );
    evidence.providerSessionId = maskIdentifier(providerSessionId);

    await phase(evidence, "therapist_presence_webhook", () =>
      waitForTherapistPresence(admin, config),
    );

    const patientJoinTransition = await phase(
      evidence,
      "patient_join_ready",
      () =>
        waitForPatientJoinTransition({
          allowManualRefreshFallback: config.allowManualRefreshFallback,
          observe: () => observePatientJoinState(pages.patient),
          timeoutMs: PATIENT_JOIN_TRANSITION_TIMEOUT_MS,
          triggerManualRefresh: () =>
            pages.patient
              .getByRole("button", { name: "Atualizar sala" })
              .click(),
        }),
    );
    evidence.patientJoin = {
      mode: patientJoinTransition.mode,
      observations: patientJoinTransition.observations,
      waitPlan: patientJoinTransition.plan,
    };

    await phase(evidence, "patient_join", async () => {
      const joinButton = pages.patient.getByRole("button", {
        name: "Entrar no encontro",
      });
      await expect(joinButton).toBeVisible({ timeout: 45_000 });
      await joinButton.click();
      await expect(
        pages.patient.getByText(/Voce entrou no encontro/i),
      ).toBeVisible({ timeout: 45_000 });
      await assertSafeShell(pages.patient, "patient_joined");
    });

    const joinedParticipations = await phase(
      evidence,
      "participant_join_evidence",
      () => waitForParticipantJoinEvidence(admin, config),
    );
    evidence.joinEvidence = {
      joinedRoles: [
        ...new Set(
          joinedParticipations
            .filter(
              (participation) =>
                participation.event_type === "session.user_joined" &&
                participation.joined_at,
            )
            .map((participation) => participation.participant_role),
        ),
      ],
    };

    await phase(evidence, "bidirectional_camera", async () => {
      await validateBidirectionalCamera({
        patientPage: pages.patient,
        therapistPage: pages.therapist,
      });
      evidence.camera = {
        activatedAfterJoin: true,
        patientLocalAndTherapistRemote: true,
        therapistLocalAndPatientRemote: true,
        toggledOff: true,
      };
    });

    await phase(evidence, "responsive_call", () =>
      captureResponsiveCallEvidence(pages.patient, logDir, evidence),
    );

    await phase(evidence, "therapist_controls", () =>
      exerciseParticipantControls(pages.therapist),
    );
    await phase(evidence, "patient_controls", () =>
      exerciseParticipantControls(pages.patient),
    );

    await phase(evidence, "admin_session_detail_active", async () => {
      await pages.admin.reload({ waitUntil: "domcontentloaded" });
      await assertAdminDetail(pages.admin);
      await assertSafeShell(pages.admin, "admin_active");
    });

    await phase(evidence, "session_duration_hold", () =>
      delay(config.durationSeconds * 1000),
    );

    await phase(evidence, "therapist_end_session", async () => {
      pages.therapist.once("dialog", (dialog) => dialog.accept());
      await pages.therapist
        .getByRole("button", { name: "Encerrar encontro" })
        .click();
      await expect(
        pages.therapist.getByText(
          /O encontro foi encerrado para todos|O encontro foi encerrado/i,
        ),
      ).toBeVisible({ timeout: 45_000 });
    });

    const endedEvidence = await phase(evidence, "post_end_db_evidence", () =>
      waitForEndedEvidence(admin, config, providerSessionId),
    );
    evidence.ended = {
      eventTypes: [
        ...new Set(endedEvidence.events.map((event) => event.event_type)),
      ].sort(),
      participations: endedEvidence.participations.map((participation) => ({
        left: Boolean(participation.left_at),
        role: participation.participant_role,
        type: participation.event_type,
      })),
      videoSession: maskSessionRecord({
        bookingId: endedEvidence.state.videoSession?.booking_id,
        providerSessionId:
          endedEvidence.state.videoSession?.provider_session_id,
        status: endedEvidence.state.videoSession?.status,
        videoSessionId: endedEvidence.state.videoSession?.id,
      }),
    };

    await phase(evidence, "post_end_shells", async () => {
      await pages.patient.reload({ waitUntil: "domcontentloaded" });
      await pages.therapist.reload({ waitUntil: "domcontentloaded" });
      await pages.admin.reload({ waitUntil: "domcontentloaded" });
      await assertPatientClosedState(pages.patient);
      await assertTherapistClosedState(pages.therapist);
      await assertAdminDetail(pages.admin);
      await Promise.all([
        assertSafeShell(pages.patient, "patient_closed"),
        assertSafeShell(pages.therapist, "therapist_closed"),
        assertSafeShell(pages.admin, "admin_closed"),
      ]);
    });
  } finally {
    if (providerSessionId) {
      const sessions = await listActiveSessions({
        sessionName: sessionSnapshot?.videoSession?.session_name,
      }).catch(() => null);
      const stillActive = Boolean(
        sessions?.ok &&
        (sessions.activeSessions ?? []).some((session) => {
          const sessionId = String(session.id ?? session.session_id ?? "");
          return sessionId === providerSessionId;
        }),
      );
      if (stillActive) {
        evidence.cleanup = {
          action: "zoom_api_end_session",
          providerSessionId: maskIdentifier(providerSessionId),
        };
        await endSessionByApi(providerSessionId).catch(() => undefined);
      }
    }

    await Promise.allSettled([
      pages.admin.close(),
      pages.patient.close(),
      pages.therapist.close(),
    ]);
    await Promise.allSettled([
      adminContext.close(),
      patientContext.close(),
      therapistContext.close(),
    ]);
    await browser.close().catch(() => undefined);
    await patientBrowser.close().catch(() => undefined);
    await writeEvidence(logDir, evidence);
  }
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  loadEnvFiles();
  loadZoomVideoSdkEnv();

  const failures = collectHarnessFailures({
    argv,
    env,
    staticZoomGateFailures: assertStaticRealZoomGates({ requireNgrok: false }),
  });

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          blocked: true,
          failures,
          nextCommand:
            "node scripts/homologation/zoom-hml.mjs --confirm-single-hml-session --confirm-hml-vercel-share",
        },
        null,
        2,
      ),
    );
    return 1;
  }

  const config = createConfig({ argv, env });
  const admin = createSupabaseAdmin(config.supabaseRuntime);
  const evidence = createEvidence(config);
  const logDir = path.join(
    process.cwd(),
    ".tmp",
    "homologation",
    evidence.runId,
  );
  await mkdir(logDir, { recursive: true });

  try {
    if (
      argv.includes("--resolve-canonical-hml-fixture") ||
      argv.includes("--prepare-canonical-hml-fixture")
    ) {
      let fixture;
      try {
        fixture = await resolveCanonicalHmlFixture(admin, {
          patientEmail: config.patientEmail,
          therapistEmail: config.therapistEmail,
        });
        evidence.fixture = { reused: true, renewable: true };
      } catch (error) {
        if (
          !argv.includes("--prepare-canonical-hml-fixture") ||
          !String(error?.message).includes("canonical_hml_fixture_not_found")
        ) {
          throw error;
        }
        fixture = await phase(evidence, "canonical_fixture_checkout", () =>
          createCanonicalHmlFixture({ admin, config, evidence, logDir }),
        );
      }
      Object.assign(config, fixture);
      Object.assign(evidence.config, {
        bookingId: maskIdentifier(config.bookingId),
        sessionPaymentId: maskIdentifier(config.sessionPaymentId),
        videoSessionId: maskIdentifier(config.videoSessionId),
      });
    }
    if (argv.includes("--resume-after-validated-join-window")) {
      evidence.resume = await loadResumeEvidence(config);
    }
    await phase(evidence, "run_hml_flow", () =>
      runFlow({ admin, config, evidence, logDir }),
    );
    evidence.finishedAt = new Date().toISOString();
    evidence.ok = true;
    await writeEvidence(logDir, evidence);
    console.log(
      JSON.stringify(
        {
          evidenceFile: path.join(logDir, "evidence.json"),
          ok: true,
          runId: evidence.runId,
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (error) {
    evidence.error = sanitizeError(error);
    evidence.finishedAt = new Date().toISOString();
    evidence.ok = false;
    await writeEvidence(logDir, evidence);
    console.error(
      JSON.stringify(
        {
          blocked: true,
          evidenceFile: path.join(logDir, "evidence.json"),
          error: evidence.error,
          phase: evidence.currentPhase,
          runId: evidence.runId,
        },
        null,
        2,
      ),
    );
    return 1;
  }
}

async function loadResumeEvidence(config) {
  if (!config.resumeEvidenceFile) {
    throw new Error("resume_evidence_file_missing");
  }
  try {
    const prior = JSON.parse(await readFile(config.resumeEvidenceFile, "utf8"));
    return validateResumeEvidence(prior, config);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("resume_")) {
      throw error;
    }
    throw new Error("resume_evidence_unreadable");
  }
}

export function validateResumeEvidence(prior, config, nowMs = Date.now()) {
  const phases = new Set(
    Array.isArray(prior?.phases)
      ? prior.phases.map((entry) => entry?.phase).filter(Boolean)
      : [],
  );
  const createdAtMs = Date.parse(prior?.createdAt ?? "");
  const sameBooking =
    prior?.preflight?.booking?.bookingId === maskIdentifier(config.bookingId);
  const samePayment =
    prior?.preflight?.sessionPayment?.sessionPaymentId ===
    maskIdentifier(config.sessionPaymentId);
  const sameVideo =
    prior?.preflight?.videoSession?.videoSessionId ===
    maskIdentifier(config.videoSessionId);
  const valid =
    prior?.hml === true &&
    Number.isFinite(createdAtMs) &&
    nowMs - createdAtMs >= 0 &&
    nowMs - createdAtMs <= 30 * 60_000 &&
    phases.has("patient_before_join_window") &&
    phases.has("wait_for_join_window") &&
    phases.has("patient_waiting_room") &&
    !prior?.providerSessionId &&
    sameBooking &&
    samePayment &&
    sameVideo;
  if (!valid) throw new Error("resume_evidence_invalid");
  return { runId: sanitizeLog(prior.runId ?? "previous-hml-run") };
}

const isMainModule =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
