import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parseZoomEnvironment } from "./config.ts";
import { basicAuth } from "./crypto.ts";
import { ZoomError } from "./errors.ts";
import {
  processZoomJob,
  processZoomJobs,
  type JobRow,
  type ZoomJobWorkerClient,
  type ZoomMeetingActions,
} from "./job-worker.ts";
import { createMeetingSdkJwt } from "./meeting-sdk-jwt.ts";
import { generateMeetingPasscode } from "./meetings.ts";
import {
  createZoomChallengeResponse,
  createZoomWebhookEventKey,
  verifyZoomWebhookSignature,
} from "./webhook.ts";
import { hmacSha256Hex } from "./crypto.ts";
import type { ZoomConfig } from "./types.ts";

Deno.test("zoom parseZoomEnvironment accepts only known values", () => {
  assertEquals(parseZoomEnvironment("development"), "development");
  assertEquals(parseZoomEnvironment("production"), "production");
  assertThrows(() => parseZoomEnvironment("staging"), Error);
});

Deno.test("zoom basicAuth encodes client id and secret", () => {
  assertEquals(basicAuth("client", "secret"), "Basic Y2xpZW50OnNlY3JldA==");
});

Deno.test(
  "zoom createMeetingSdkJwt creates role 0 and role 1 JWTs",
  async () => {
    const config = fakeConfig();
    const patientJwt = await createMeetingSdkJwt({
      config,
      meetingNumber: "123456789",
      nowSeconds: 1_700_000_000,
      role: 0,
    });
    const therapistJwt = await createMeetingSdkJwt({
      config,
      meetingNumber: "123456789",
      nowSeconds: 1_700_000_000,
      role: 1,
    });

    assertEquals(patientJwt.split(".").length, 3);
    assertEquals(therapistJwt.split(".").length, 3);
    assert(patientJwt !== therapistJwt);

    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(patientJwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          (char) => char.charCodeAt(0),
        ),
      ),
    );
    assertEquals(claims.mn, "123456789");
    assertEquals(claims.role, 0);
    assertEquals(claims.exp, 1_700_000_000 + 60 * 60 * 2);
  },
);

Deno.test(
  "zoom webhook challenge response uses secret token HMAC",
  async () => {
    const response = await createZoomChallengeResponse("plain", "secret");

    assertEquals(response.plainToken, "plain");
    assertEquals(
      response.encryptedToken,
      await hmacSha256Hex("secret", "plain"),
    );
  },
);

Deno.test(
  "zoom webhook signature rejects replay and invalid signatures",
  async () => {
    const body = JSON.stringify({ event: "meeting.started" });
    const timestamp = "1700000000";
    const signature = `v0=${await hmacSha256Hex("secret", `v0:${timestamp}:${body}`)}`;

    await verifyZoomWebhookSignature({
      body,
      nowSeconds: 1_700_000_010,
      secretToken: "secret",
      signature,
      timestamp,
    });

    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_001_000,
        secretToken: "secret",
        signature,
        timestamp,
      }),
    );
    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_000_010,
        secretToken: "secret",
        signature: "v0=bad",
        timestamp,
      }),
    );
    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_000_010,
        secretToken: "secret",
        signature: null,
        timestamp,
      }),
    );
  },
);

Deno.test(
  "zoom webhook event key changes with request id for controlled duplicates",
  async () => {
    const body = JSON.stringify({ event: "meeting.started" });
    const base = {
      body,
      eventTs: 1_700_000_000,
      eventType: "meeting.started",
      meetingId: "123",
      meetingUuid: "uuid",
      participantId: null,
    };

    const first = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-a",
    });
    const duplicate = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-a",
    });
    const secondDelivery = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-b",
    });

    assertEquals(first, duplicate);
    assert(first !== secondDelivery);
  },
);

Deno.test("zoom generated passcode respects common Zoom account limits", () => {
  const passcode = generateMeetingPasscode();

  assertEquals(passcode.length, 10);
  assert(/^[A-HJ-NP-Za-km-z2-9]{10}$/.test(passcode));
});

Deno.test("zoom job worker reports empty queue", async () => {
  const client = new FakeZoomJobClient({ jobs: [] });

  const result = await processZoomJobs({
    actions: fakeActions(),
    client,
    config: fakeConfig(),
    now: new Date("2026-07-26T12:00:00.000Z"),
    requestId: "request-empty",
  });

  assertEquals(result.empty, true);
  assertEquals(result.processed, 0);
  assertEquals(result.reserved, 0);
});

Deno.test("zoom job worker processes a bounded batch", async () => {
  const jobs = Array.from({ length: 6 }, (_, index) =>
    fakeJob(`job-${index + 1}`, "meeting-1"),
  );
  const client = new FakeZoomJobClient({ jobs });

  const result = await processZoomJobs({
    actions: fakeActions(),
    client,
    config: fakeConfig(),
    maxJobs: 5,
    now: new Date("2026-07-26T12:00:00.000Z"),
    requestId: "request-batch",
  });

  assertEquals(result.empty, false);
  assertEquals(result.processed, 5);
  assertEquals(result.succeeded, 5);
  assertEquals(client.completed.length, 5);
});

Deno.test("zoom job worker retries transient Zoom failures", async () => {
  const client = new FakeZoomJobClient({
    jobs: [fakeJob("job-retry", "meeting-1")],
  });

  const result = await processZoomJobs({
    actions: fakeActions({
      createMeeting: () => {
        throw new ZoomError("zoom_http_429", 429, "Rate limited", 45);
      },
    }),
    client,
    config: fakeConfig(),
    now: new Date("2026-07-26T12:00:00.000Z"),
    requestId: "request-retry",
  });

  assertEquals(result.processed, 1);
  assertEquals(result.retried, 1);
  assertEquals(client.jobStatuses.get("job-retry"), "retry_scheduled");
});

Deno.test(
  "zoom job worker moves exhausted retries to dead letter",
  async () => {
    const client = new FakeZoomJobClient({
      jobs: [
        fakeJob("job-dead", "meeting-1", { attempts: 4, max_attempts: 5 }),
      ],
    });

    const result = await processZoomJobs({
      actions: fakeActions({
        createMeeting: () => {
          throw new ZoomError("zoom_http_503", 503, "Unavailable");
        },
      }),
      client,
      config: fakeConfig(),
      now: new Date("2026-07-26T12:00:00.000Z"),
      requestId: "request-dead",
    });

    assertEquals(result.processed, 1);
    assertEquals(result.deadLetter, 1);
    assertEquals(client.jobStatuses.get("job-dead"), "dead_letter");
  },
);

Deno.test(
  "zoom job worker treats remote cancel 404 as idempotent success",
  async () => {
    const client = new FakeZoomJobClient({
      jobs: [fakeJob("job-cancel", "meeting-1", { operation: "cancel" })],
      remoteMeetingId: "remote-123",
    });

    await processZoomJob(
      client,
      fakeConfig(),
      fakeJob("job-cancel", "meeting-1", {
        operation: "cancel",
      }),
      fakeActions({
        deleteMeeting: () => {
          throw new ZoomError("zoom_http_404", 404, "Not found");
        },
      }),
    );

    assertEquals(client.meetingStatus, "canceled");
  },
);

function fakeConfig(): ZoomConfig {
  return {
    accountId: "account",
    apiBaseUrl: "https://api.zoom.us",
    defaultHostUserId: "host",
    environment: "development",
    meetingSdkClientId: "sdk-client",
    meetingSdkClientSecret: "sdk-secret",
    s2sClientId: "s2s-client",
    s2sClientSecret: "s2s-secret",
    webhookSecretToken: "webhook-secret",
  };
}

function fakeJob(
  id: string,
  zoomMeetingId: string,
  overrides: Partial<JobRow> = {},
): JobRow {
  return {
    attempts: 1,
    booking_id: "booking-1",
    id,
    max_attempts: 5,
    operation: "create",
    payload: {},
    zoom_meeting_id: zoomMeetingId,
    ...overrides,
  };
}

function fakeActions(
  overrides: Partial<ZoomMeetingActions> = {},
): ZoomMeetingActions {
  return {
    createMeeting: () =>
      Promise.resolve({
        created_at: "2026-07-26T12:00:00.000Z",
        id: "remote-123",
        join_url: "URL_REDACTED",
        start_url: "URL_REDACTED",
        uuid: "remote-uuid",
      }),
    deleteMeeting: () => Promise.resolve(),
    getMeeting: () =>
      Promise.resolve({
        id: "remote-123",
        uuid: "remote-uuid",
      }),
    updateMeeting: () => Promise.resolve(),
    ...overrides,
  } as ZoomMeetingActions;
}

class FakeZoomJobClient implements ZoomJobWorkerClient {
  completed: unknown[] = [];
  jobStatuses = new Map<string, string>();
  meetingStatus = "pending_provisioning";
  private readonly jobs: JobRow[];
  private readonly remoteMeetingId: string | null;

  constructor(options: { jobs: JobRow[]; remoteMeetingId?: string | null }) {
    this.jobs = [...options.jobs];
    this.remoteMeetingId = options.remoteMeetingId ?? null;
  }

  get<T>(path: string): Promise<T> {
    if (path.includes("zoom_meeting_jobs?select=created_at")) {
      return Promise.resolve([{ created_at: "2026-07-26T11:59:00.000Z" }] as T);
    }

    if (path.includes("zoom_meeting_jobs?select=status")) {
      const id = decodeURIComponent(path.match(/id=eq\.([^&]+)/)?.[1] ?? "");
      return Promise.resolve([{ status: this.jobStatuses.get(id) }] as T);
    }

    if (path.includes("zoom_meetings?select=")) {
      return Promise.resolve([
        {
          booking_id: "booking-1",
          duration_minutes: 50,
          id: "meeting-1",
          scheduled_ends_at: "2026-07-26T13:50:00.000Z",
          scheduled_starts_at: "2026-07-26T13:00:00.000Z",
          timezone: "America/Sao_Paulo",
          topic: "Sessao Terapeuta Eu Sou",
          zoom_host_user_id: "host",
          zoom_meeting_id: this.remoteMeetingId,
        },
      ] as T);
    }

    if (path.includes("bookings?select=")) {
      return Promise.resolve([
        { id: "booking-1", payment_status: "paid", status: "confirmed" },
      ] as T);
    }

    if (path.includes("session_payments?select=")) {
      return Promise.resolve([{ financial_status: "paid" }] as T);
    }

    return Promise.resolve([] as T);
  }

  patch<T>(
    _path: string,
    body: Record<string, unknown>,
    _prefer?: string,
  ): Promise<T> {
    if (typeof body.status === "string") this.meetingStatus = body.status;

    return Promise.resolve(undefined as T);
  }

  rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (name === "reserve_zoom_meeting_job_v1") {
      const job = this.jobs.shift();
      if (!job) return Promise.resolve([] as T);

      return Promise.resolve([{ ...job, attempts: job.attempts + 1 }] as T);
    }

    if (name === "complete_zoom_meeting_job_v1") {
      this.completed.push(body);
      const status = finalStatusFromCompletion(body);
      this.jobStatuses.set(String(body.p_job_id), status);

      return Promise.resolve(undefined as T);
    }

    return Promise.resolve(undefined as T);
  }
}

function finalStatusFromCompletion(body: Record<string, unknown>) {
  if (body.p_status === "succeeded") return "succeeded";

  const retryAfter = Number(body.p_retry_after_seconds ?? 0);
  const jobId = String(body.p_job_id);

  if (retryAfter <= 0) return "failed";
  if (jobId.includes("dead")) return "dead_letter";

  return "retry_scheduled";
}
