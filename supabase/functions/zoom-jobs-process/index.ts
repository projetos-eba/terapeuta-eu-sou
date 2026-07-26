import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { getZoomConfig } from "../_shared/zoom/config.ts";
import { ZoomError, sanitizeProviderMessage } from "../_shared/zoom/errors.ts";
import {
  buildSanitizedTopic,
  createZoomMeeting,
  deleteZoomMeeting,
  generateMeetingPasscode,
  getZoomMeeting,
  updateZoomMeeting,
} from "../_shared/zoom/meetings.ts";
import { logZoomOperation } from "../_shared/zoom/observability.ts";

type JobRow = {
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

const runtime = getPaymentsRuntime("zoom-jobs-process");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

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

    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const config = getZoomConfig(runtime);
    const [job] = await client.rpc<JobRow[]>("reserve_zoom_meeting_job_v1", {
      p_now: new Date().toISOString(),
      p_worker_id: `zoom-edge-${requestId}`,
    });

    if (!job) return success({ processed: false, reason: "empty_queue" });

    try {
      await processJob(client, config, job);
      await client.rpc("complete_zoom_meeting_job_v1", {
        p_error_code: null,
        p_error_message: null,
        p_job_id: job.id,
        p_retry_after_seconds: null,
        p_status: "succeeded",
      });
      logZoomOperation("info", {
        attempt: job.attempts,
        bookingId: job.booking_id,
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        operation: job.operation,
        requestId,
        result: "succeeded",
      });

      return success({ jobId: job.id, processed: true });
    } catch (error) {
      const retryAfter = getRetryAfter(error, job.attempts);
      await client.rpc("complete_zoom_meeting_job_v1", {
        p_error_code:
          error instanceof ZoomError ? error.code : "zoom_job_failed",
        p_error_message: sanitizeProviderMessage(error),
        p_job_id: job.id,
        p_retry_after_seconds: retryAfter,
        p_status: "failed",
      });
      throw error;
    }
  } catch (error) {
    return failure(error, requestId);
  }
});

async function processJob(
  client: SupabaseRestClient,
  config: ReturnType<typeof getZoomConfig>,
  job: JobRow,
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
        await deleteZoomMeeting(config, meeting.zoom_meeting_id);
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
        await getZoomMeeting(config, meeting.zoom_meeting_id);
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

    await updateZoomMeeting(config, meeting.zoom_meeting_id, payload);
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

  const created = await createZoomMeeting(config, payload);
  await patchMeeting(client, meeting.id, {
    last_error_code: null,
    last_error_message: null,
    last_synced_at: new Date().toISOString(),
    provider_created_at: created.created_at ?? new Date().toISOString(),
    provider_updated_at: new Date().toISOString(),
    status: "scheduled",
    topic: payload.topic,
    zoom_meeting_id: String(created.id),
    zoom_meeting_uuid: created.uuid ?? null,
  });
}

async function patchMeeting(
  client: SupabaseRestClient,
  localMeetingId: string,
  body: Record<string, unknown>,
) {
  await client.patch(
    `/rest/v1/zoom_meetings?id=eq.${encodeURIComponent(localMeetingId)}`,
    body,
    "return=minimal",
  );
}

async function getBookingState(client: SupabaseRestClient, bookingId: string) {
  const [booking] = await client.get<BookingState[]>(
    `/rest/v1/bookings?select=id,status,payment_status&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  );

  return booking ?? null;
}

async function isBookingPaid(client: SupabaseRestClient, bookingId: string) {
  const [payment] = await client.get<SessionPaymentState[]>(
    `/rest/v1/session_payments?select=financial_status&booking_id=eq.${encodeURIComponent(bookingId)}&financial_status=eq.paid&limit=1`,
  );

  return Boolean(payment);
}

function getRetryAfter(error: unknown, attempts: number) {
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

  if (error instanceof ZoomError && error.retryAfterSeconds) {
    return error.retryAfterSeconds;
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

export {};
