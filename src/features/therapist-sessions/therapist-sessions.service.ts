import "server-only";

import type { TherapistPlan } from "@/domain/tes";
import {
  parseTherapistSessionDetailReadModel,
  parseTherapistPendingConfirmationsSummary,
  parseTherapistSessionsReadModel,
  SessionReadModelContractError,
  type ReadModelErrorCode,
  type ReadModelResult,
  type TherapistSessionDetailReadModel,
  type TherapistPendingConfirmationsSummary,
  type TherapistSessionFilters,
  type TherapistSessionsReadModel,
} from "@/features/bookings";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import {
  queryActorSessionStates,
  queryTherapistPendingReschedule,
  queryTherapistPendingConfirmations,
  queryTherapistSessionDetail,
  queryTherapistSessionFeedback,
  queryTherapistSessions,
} from "./therapist-sessions.queries";

export type TherapistSessionPendingReschedule = {
  expiresAt: string | null;
  id: string;
  kind: "legacy" | "therapist_cancellation" | "therapist_reschedule";
  proposedEndsAt: string | null;
  proposedStartsAt: string | null;
  proposedTimezone: string;
  reason: string | null;
  requestedByCurrentUser: boolean;
  status: "pending" | "pending_admin_review";
};

export type TherapistSessionFeedbackStatus =
  | "automatically_confirmed"
  | "before_session"
  | "eligible"
  | "incident_only"
  | "submitted"
  | "unavailable";

export type TherapistSessionFeedbackSummary = {
  quality?: import("@/features/session-feedback/session-feedback.types").SessionFeedbackReadPayload;
  outcome: "completed" | "not_performed" | null;
  status: TherapistSessionFeedbackStatus;
};

export function shouldShowTherapistSessionJourneyThemes(
  plan: TherapistPlan,
  feedback: TherapistSessionFeedbackSummary,
) {
  return (
    plan === "premium_plus" &&
    feedback.status === "submitted" &&
    feedback.outcome === "completed"
  );
}

export async function getTherapistSessionsPage(input: {
  accessToken: string;
  filters: TherapistSessionFilters;
  profileId: string;
}): Promise<ReadModelResult<TherapistSessionsReadModel>> {
  const result = await runReadOperation({
    accessToken: input.accessToken,
    operation: "get_therapist_sessions_v1",
    parse: parseTherapistSessionsReadModel,
    profileId: input.profileId,
    query: () => queryTherapistSessions(input.accessToken, input.filters),
  });

  if (result.status === "success" && result.data.items.length === 0) {
    return { data: null, status: "empty" };
  }

  return result;
}

export async function getTherapistPendingConfirmationsSummary(input: {
  accessToken: string;
  profileId: string;
}): Promise<ReadModelResult<TherapistPendingConfirmationsSummary>> {
  return runReadOperation({
    accessToken: input.accessToken,
    operation: "get_therapist_pending_confirmations_v1",
    parse: parseTherapistPendingConfirmationsSummary,
    profileId: input.profileId,
    query: () => queryTherapistPendingConfirmations(input.accessToken),
  });
}

export async function getTherapistActorSessionStates(input: {
  accessToken: string;
  bookingIds: string[];
}): Promise<{
  pendingFeedbackIds: ReadonlySet<string>;
  realizedIds: ReadonlySet<string>;
}> {
  try {
    const states = await queryActorSessionStates(
      input.accessToken,
      input.bookingIds,
    );

    const pendingFeedbackIds = new Set<string>();
    const realizedIds = new Set<string>();
    for (const [bookingId, state] of Object.entries(states)) {
      if (state?.actorRealized === true) {
        realizedIds.add(bookingId);
      } else if (
        state?.bothJoined === true &&
        state?.sessionClosed === true &&
        state?.classification == null
      ) {
        pendingFeedbackIds.add(bookingId);
      }
    }
    return { pendingFeedbackIds, realizedIds };
  } catch {
    return { pendingFeedbackIds: new Set(), realizedIds: new Set() };
  }
}

export async function getTherapistSessionDetail(input: {
  accessToken: string;
  bookingId: string;
  profileId: string;
}): Promise<ReadModelResult<TherapistSessionDetailReadModel>> {
  return runReadOperation({
    accessToken: input.accessToken,
    bookingId: input.bookingId,
    operation: "get_therapist_session_detail_v1",
    parse: parseTherapistSessionDetailReadModel,
    profileId: input.profileId,
    query: () =>
      queryTherapistSessionDetail(input.accessToken, input.bookingId),
    treatNullAsEmpty: true,
  });
}

export async function getTherapistSessionPendingReschedule(input: {
  accessToken: string;
  bookingId: string;
  userId: string;
}): Promise<TherapistSessionPendingReschedule | null> {
  try {
    const row = await queryTherapistPendingReschedule(
      input.accessToken,
      input.bookingId,
    );

    if (!row) return null;

    return {
      expiresAt: row.expires_at,
      id: row.id,
      kind: row.change_kind,
      proposedEndsAt: row.proposed_ends_at,
      proposedStartsAt: row.proposed_starts_at,
      proposedTimezone: row.proposed_timezone,
      reason: row.reason,
      requestedByCurrentUser: row.requested_by_profile_id === input.userId,
      status: row.status,
    };
  } catch {
    return null;
  }
}

export async function getTherapistSessionFeedbackStatus(input: {
  accessToken: string;
  bookingId: string;
}): Promise<TherapistSessionFeedbackStatus> {
  return (await getTherapistSessionFeedbackSummary(input)).status;
}

export async function getTherapistSessionFeedbackSummary(input: {
  accessToken: string;
  bookingId: string;
}): Promise<TherapistSessionFeedbackSummary> {
  try {
    const payload = await queryTherapistSessionFeedback(
      input.accessToken,
      input.bookingId,
    );
    const status = getFeedbackStatus(payload);
    const outcome = getFeedbackOutcome(payload);
    const quality =
      payload as import("@/features/session-feedback/session-feedback.types").SessionFeedbackReadPayload;

    if (
      status === "eligible" ||
      status === "before_session" ||
      status === "incident_only" ||
      status === "automatically_confirmed"
    ) {
      return { outcome: null, status, quality };
    }
    if (status === "submitted") {
      return { outcome, status, quality };
    }

    return { outcome: null, status: "unavailable", quality };
  } catch {
    return { outcome: null, status: "unavailable" };
  }
}

async function runReadOperation<T>(input: {
  accessToken: string;
  bookingId?: string;
  operation: string;
  parse: (value: unknown) => T;
  profileId: string;
  query: () => Promise<unknown>;
  treatNullAsEmpty?: boolean;
}): Promise<ReadModelResult<T>> {
  const correlationId = createCorrelationId();
  const startedAt = performance.now();

  try {
    const response = await input.query();
    if (input.treatNullAsEmpty && response === null) {
      return { data: null, status: "empty" };
    }

    const data = input.parse(response);
    const responseProfileId = getResponseProfileId(data);

    if (responseProfileId !== input.profileId) {
      throw new ReadModelAccessError();
    }

    return { data, status: "success" };
  } catch (error) {
    const code = getReadModelErrorCode(error);
    const externalStatus =
      error instanceof SupabaseServerRestError ? error.status : undefined;
    logServerOperationFailure({
      actorRole: "therapist",
      bookingId: input.bookingId,
      correlationId,
      durationMs: performance.now() - startedAt,
      errorCode: code,
      externalStatus,
      operation: input.operation,
    });

    return {
      data: null,
      error: {
        code,
        correlationId,
        message: getSafeMessage(code),
      },
      status: "error",
    };
  }
}

function getResponseProfileId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profileId = Reflect.get(value, "therapistProfileId");
  return typeof profileId === "string" ? profileId : null;
}

function getFeedbackStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = Reflect.get(value, "status");
  return typeof status === "string" ? status : null;
}

function getFeedbackOutcome(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const feedback = Reflect.get(value, "feedback");
  if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) {
    return null;
  }
  const outcome = Reflect.get(feedback, "outcome");
  if (typeof Reflect.get(feedback, "successful") === "boolean")
    return "completed";
  return outcome === "completed" || outcome === "not_performed"
    ? outcome
    : null;
}

function getReadModelErrorCode(error: unknown): ReadModelErrorCode {
  if (error instanceof ReadModelAccessError) return "forbidden";
  if (error instanceof SessionReadModelContractError) return "invalid_contract";
  if (error instanceof SupabaseServerRestError) {
    if (error.status === 401) return "session_expired";
    if (error.status === 403 || error.status === 404) return "forbidden";
    if (error.status === 400) return "invalid_filter";
  }
  return "unavailable";
}

function getSafeMessage(code: ReadModelErrorCode) {
  if (code === "session_expired") {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (code === "invalid_filter") {
    return "Revise os filtros informados e tente novamente.";
  }
  if (code === "forbidden") {
    return "Esta sessão não está disponível para a sua conta.";
  }

  return "Não foi possível carregar as sessões agora.";
}

class ReadModelAccessError extends Error {}
