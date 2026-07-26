import "server-only";

import {
  parseTherapistSessionDetailReadModel,
  parseTherapistSessionsReadModel,
  SessionReadModelContractError,
  type ReadModelErrorCode,
  type ReadModelResult,
  type TherapistSessionDetailReadModel,
  type TherapistSessionFilters,
  type TherapistSessionsReadModel,
} from "@/features/bookings";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import {
  queryTherapistSessionDetail,
  queryTherapistSessions,
} from "./therapist-sessions.queries";

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
