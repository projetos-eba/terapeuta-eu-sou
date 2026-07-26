import "server-only";

import {
  parseTherapistAgendaReadModel,
  SessionReadModelContractError,
  type ReadModelErrorCode,
  type ReadModelResult,
  type TherapistAgendaReadModel,
} from "@/features/bookings";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import { queryTherapistAgenda } from "./therapist-agenda.queries";

export async function getTherapistAgendaPage(input: {
  accessToken: string;
  profileId: string;
  rangeEnd?: string;
  rangeStart?: string;
}): Promise<ReadModelResult<TherapistAgendaReadModel>> {
  const correlationId = createCorrelationId();
  const startedAt = performance.now();

  try {
    const response = await queryTherapistAgenda(input);
    const data = parseTherapistAgendaReadModel(response);

    if (data.therapistProfileId !== input.profileId) {
      throw new AgendaAccessError();
    }

    if (
      data.bookings.length === 0 &&
      data.holds.length === 0 &&
      data.availability.rules.length === 0 &&
      data.availability.exceptions.length === 0
    ) {
      return { data: null, status: "empty" };
    }

    return { data, status: "success" };
  } catch (error) {
    const code = getErrorCode(error);
    logServerOperationFailure({
      actorRole: "therapist",
      correlationId,
      durationMs: performance.now() - startedAt,
      errorCode: code,
      externalStatus:
        error instanceof SupabaseServerRestError ? error.status : undefined,
      operation: "get_therapist_agenda_v1",
    });

    return {
      data: null,
      error: {
        code,
        correlationId,
        message:
          code === "invalid_filter"
            ? "Revise o período informado e tente novamente."
            : "Não foi possível carregar a agenda agora.",
      },
      status: "error",
    };
  }
}

function getErrorCode(error: unknown): ReadModelErrorCode {
  if (error instanceof AgendaAccessError) return "forbidden";
  if (error instanceof SessionReadModelContractError) return "invalid_contract";
  if (error instanceof SupabaseServerRestError) {
    if (error.status === 401) return "session_expired";
    if (error.status === 403 || error.status === 404) return "forbidden";
    if (error.status === 400) return "invalid_filter";
  }
  return "unavailable";
}

class AgendaAccessError extends Error {}
