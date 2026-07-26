import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { DomainError } from "../payments/http.ts";
import { ZoomError, sanitizeProviderMessage } from "./errors.ts";
import {
  buildSanitizedTopic,
  createZoomMeeting,
  deleteZoomMeeting,
  generateMeetingPasscode,
  getZoomMeeting,
  updateZoomMeeting,
} from "./meetings.ts";
import { logZoomOperation } from "./observability.ts";
import type { ZoomConfig } from "./types.ts";

export type JobRow = {
  attempts: number;
  booking_id: string;
  id: string;
  max_attempts: number;
  operation: "cancel" | "create" | "reconcile" | "update";
  payload: Record<string, unknown>;
  zoom_meeting_id: string | null;
};

type LocalZoomMeeting = {
  id: string;
  booking_id: string;
  duration_minutes: number;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  timezone: string;
  topic: string;
  zoom_host_user_id: string;
  zoom_meeting_id: string | null;
};

type BookingState = {
  id: string;
  payment_status: string;
  status: string;
};

type SessionPaymentState = {
  financial_status: string;
};

type QueueAgeRow = {
  created_at: string;
};

type JobStatusRow = {
  status:
    | "dead_letter"
    | "failed"
    | "pending"
    | "processing"
    | "retry_scheduled"
    | "succeeded";
};

export type ZoomJobWorkerClient = Pick<
  SupabaseRestClient,
  "get" | "patch" | "rpc"
>;

export type ZoomMeetingActions = {
  createMeeting: typeof createZoomMeeting;
  deleteMeeting: typeof deleteZoomMeeting;
  getMeeting: typeof getZoomMeeting;
  updateMeeting: typeof updateZoomMeeting;
};

export type ZoomJobsResult = {
  deadLetter: number;
  durationMs: number;
  empty: boolean;
  failed: number;
  maxDurationReached: boolean;
  oldestJobAgeSeconds: number | null;
  processed: number;
  requestId: string;
  reserved: number;
  retried: number;
  succeeded: number;
  workerId: string;
};

const DEFAULT_MAX_JOBS = 5;
const DEFAULT_MAX_DURATION_MS = 8_500;

const defaultActions: ZoomMeetingActions = {
  createMeeting: createZoomMeeting,
  deleteMeeting: deleteZoomMeeting,
  getMeeting: getZoomMeeting,
  updateMeeting: updateZoomMeeting,
};

export async function processZoomJobs(options: {
  actions?: ZoomMeetingActions;
  client: ZoomJobWorkerClient;
  config: ZoomConfig;
  maxDurationMs?: number;
  maxJobs?: number;
  now?: Date;
  requestId: string;
  workerId?: string;
}): Promise<ZoomJobsResult> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const maxJobs = clampBatchSize(options.maxJobs ?? DEFAULT_MAX_JOBS);
  const maxDurationMs = Math.max(
    1_000,
    options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS,
  );
  const workerId = options.workerId ?? `zoom-edge-${options.requestId}`;
  const actions = options.actions ?? defaultActions;
  const oldestJobAgeSeconds = await getOldestAvailableJobAgeSeconds(
    options.client,
    now,
  );
  const result: ZoomJobsResult = {
    deadLetter: 0,
    durationMs: 0,
    empty: false,
    failed: 0,
    maxDurationReached: false,
    oldestJobAgeSeconds,
    processed: 0,
    requestId: options.requestId,
    reserved: 0,
    retried: 0,
    succeeded: 0,
    workerId,
  };

  while (result.reserved < maxJobs) {
    if (Date.now() - startedAt >= maxDurationMs) {
      result.maxDurationReached = true;
      break;
    }

    const [job] = await options.client.rpc<JobRow[]>(
      "reserve_zoom_meeting_job_v1",
      {
        p_now: new Date().toISOString(),
        p_worker_id: workerId,
      },
    );

    if (!job) break;

    result.reserved += 1;
    result.processed += 1;

    try {
      await processZoomJob(options.client, options.config, job, actions);
      await options.client.rpc("complete_zoom_meeting_job_v1", {
        p_error_code: null,
        p_error_message: null,
        p_job_id: job.id,
        p_retry_after_seconds: null,
        p_status: "succeeded",
      });
      result.succeeded += 1;
      logZoomOperation("info", {
        attempt: job.attempts,
        bookingId: job.booking_id,
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        operation: job.operation,
        requestId: options.requestId,
        result: "succeeded",
        workerId,
      });
    } catch (error) {
      const retryAfter = getRetryAfter(error, job.attempts);
      await options.client.rpc("complete_zoom_meeting_job_v1", {
        p_error_code:
          error instanceof ZoomError ? error.code : "zoom_job_failed",
        p_error_message: sanitizeProviderMessage(error),
        p_job_id: job.id,
        p_retry_after_seconds: retryAfter,
        p_status: "failed",
      });
      const finalStatus = await getJobStatus(options.client, job.id);
      if (finalStatus === "retry_scheduled") result.retried += 1;
      else if (finalStatus === "dead_letter") result.deadLetter += 1;
      else result.failed += 1;

      logZoomOperation("warn", {
        attempt: job.attempts,
        bookingId: job.booking_id,
        code: error instanceof ZoomError ? error.code : "zoom_job_failed",
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        operation: job.operation,
        requestId: options.requestId,
        result: finalStatus ?? "failed",
        workerId,
      });
    }
  }

  result.empty = result.reserved === 0;
  result.durationMs = Date.now() - startedAt;

  logZoomOperation("info", {
    deadLetter: result.deadLetter,
    durationMs: result.durationMs,
    oldestJobAgeSeconds: result.oldestJobAgeSeconds,
    processed: result.processed,
    requestId: result.requestId,
    reserved: result.reserved,
    retry: result.retried,
    success: result.succeeded,
    workerId,
  });

  return result;
}

export async function processZoomJob(
  client: ZoomJobWorkerClient,
  config: ZoomConfig,
  job: JobRow,
  actions: ZoomMeetingActions = defaultActions,
) {
  const [meeting] = await client.get<LocalZoomMeeting[]>(
    `/rest/v1/zoom_meetings?select=id,booking_id,zoom_meeting_id,zoom_host_user_id,topic,scheduled_starts_at,scheduled_ends_at,duration_minutes,timezone&id=eq.${encodeURIComponent(job.zoom_meeting_id ?? "")}&limit=1`,
  );

  if (!meeting) {
    throw new DomainError(
      "zoom_meeting_not_found",
      404,
      "Reuniao Zoom nao encontrada.",
    );
  }

  const bookingState = await getBookingState(client, meeting.booking_id);
  if (!bookingState || isClosedBookingStatus(bookingState.status)) {
    await patchMeeting(client, meeting.id, {
      last_synced_at: new Date().toISOString(),
      status: "canceled",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  if (job.operation === "cancel") {
    if (meeting.zoom_meeting_id) {
      try {
        await actions.deleteMeeting(config, meeting.zoom_meeting_id);
      } catch (error) {
        if (!(error instanceof ZoomError && error.status === 404)) {
          throw error;
        }
      }
    }
    await patchMeeting(client, meeting.id, {
      last_synced_at: new Date().toISOString(),
      status: "canceled",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  if (!(await isBookingPaid(client, meeting.booking_id))) {
    throw new DomainError(
      "zoom_booking_payment_not_confirmed",
      409,
      "Pagamento da sessao ainda nao confirmado.",
    );
  }

  const payload = {
    durationMinutes: meeting.duration_minutes,
    hostUserId: meeting.zoom_host_user_id,
    passcode: generateMeetingPasscode(),
    startTime: meeting.scheduled_starts_at,
    timezone: meeting.timezone,
    topic: buildSanitizedTopic(meeting.booking_id),
  };

  if (meeting.zoom_meeting_id) {
    if (job.operation === "reconcile") {
      try {
        await actions.getMeeting(config, meeting.zoom_meeting_id);
      } catch (error) {
        if (error instanceof ZoomError && error.status === 404) {
          await patchMeeting(client, meeting.id, {
            last_error_code: "zoom_remote_meeting_missing",
            last_error_message: "Reuniao remota nao encontrada no Zoom.",
            last_synced_at: new Date().toISOString(),
            status: "failed",
            updated_at: new Date().toISOString(),
          });
          throw new DomainError(
            "zoom_remote_meeting_missing",
            409,
            "Reuniao remota nao encontrada no Zoom.",
          );
        }

        throw error;
      }
    }

    await actions.updateMeeting(config, meeting.zoom_meeting_id, payload);
    await patchMeeting(client, meeting.id, {
      last_error_code: null,
      last_error_message: null,
      last_synced_at: new Date().toISOString(),
      status: "scheduled",
      topic: payload.topic,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const created = await actions.createMeeting(config, payload);
  await patchMeeting(client, meeting.id, {
    last_error_code: null,
    last_error_message: null,
    last_synced_at: new Date().toISOString(),
    provider_created_at: created.created_at ?? new Date().toISOString(),
    provider_updated_at: new Date().toISOString(),
    status: "scheduled",
    topic: payload.topic,
    updated_at: new Date().toISOString(),
    zoom_meeting_id: String(created.id),
    zoom_meeting_uuid: created.uuid ?? null,
  });
}

async function patchMeeting(
  client: ZoomJobWorkerClient,
  localMeetingId: string,
  body: Record<string, unknown>,
) {
  await client.patch(
    `/rest/v1/zoom_meetings?id=eq.${encodeURIComponent(localMeetingId)}`,
    body,
    "return=minimal",
  );
}

async function getBookingState(client: ZoomJobWorkerClient, bookingId: string) {
  const [booking] = await client.get<BookingState[]>(
    `/rest/v1/bookings?select=id,status,payment_status&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  );

  return booking ?? null;
}

async function isBookingPaid(client: ZoomJobWorkerClient, bookingId: string) {
  const [payment] = await client.get<SessionPaymentState[]>(
    `/rest/v1/session_payments?select=financial_status&booking_id=eq.${encodeURIComponent(bookingId)}&financial_status=eq.paid&limit=1`,
  );

  return Boolean(payment);
}

async function getJobStatus(client: ZoomJobWorkerClient, jobId: string) {
  const [job] = await client.get<JobStatusRow[]>(
    `/rest/v1/zoom_meeting_jobs?select=status&id=eq.${encodeURIComponent(jobId)}&limit=1`,
  );

  return job?.status ?? null;
}

async function getOldestAvailableJobAgeSeconds(
  client: ZoomJobWorkerClient,
  now: Date,
) {
  const [job] = await client.get<QueueAgeRow[]>(
    `/rest/v1/zoom_meeting_jobs?select=created_at&status=in.(pending,retry_scheduled)&available_at=lte.${encodeURIComponent(now.toISOString())}&order=created_at.asc&limit=1`,
  );

  if (!job?.created_at) return null;

  const createdAt = new Date(job.created_at).getTime();
  if (!Number.isFinite(createdAt)) return null;

  return Math.max(0, Math.floor((now.getTime() - createdAt) / 1000));
}

function getRetryAfter(error: unknown, attempts: number) {
  if (error instanceof ZoomError && error.retryAfterSeconds) {
    return error.retryAfterSeconds;
  }

  if (error instanceof ZoomError && error.status === 429) {
    return Math.min(900, 30 * 2 ** Math.max(0, attempts - 1));
  }

  if (error instanceof ZoomError && error.status >= 400 && error.status < 500) {
    return null;
  }

  if (
    error instanceof DomainError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return null;
  }

  return Math.min(900, 30 * 2 ** Math.max(0, attempts - 1));
}

function isClosedBookingStatus(status: string) {
  return [
    "cancelled_by_patient",
    "cancelled_by_therapist",
    "refunded",
  ].includes(status);
}

function clampBatchSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_JOBS;

  return Math.max(1, Math.min(DEFAULT_MAX_JOBS, Math.floor(value)));
}
