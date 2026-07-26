import "server-only";

import type { TherapistScheduleReadModel } from "@/domain/tes";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import {
  type TherapistScheduleErrorCode,
  TherapistScheduleContractError,
} from "./therapist-schedule.errors";
import { parseTherapistScheduleReadModel } from "./therapist-schedule.parsers";
import { queryTherapistSchedule } from "./therapist-schedule.queries";

export type TherapistScheduleResult =
  | { data: TherapistScheduleReadModel; status: "success" }
  | {
      data: null;
      error: {
        code: TherapistScheduleErrorCode;
        correlationId: string;
        message: string;
      };
      status: "error";
    };

export async function getTherapistSchedule(input: {
  accessToken: string;
  profileId: string;
}): Promise<TherapistScheduleResult> {
  const correlationId = createCorrelationId();
  const startedAt = performance.now();

  try {
    const response = await queryTherapistSchedule(input.accessToken);
    const data = parseTherapistScheduleReadModel(response);

    if (data.therapistProfileId !== input.profileId) {
      throw new TherapistScheduleAccessError();
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
      operation: "get_therapist_schedule_v1",
    });

    return {
      data: null,
      error: {
        code,
        correlationId,
        message:
          code === "session_expired"
            ? "Sua sessão expirou. Entre novamente para continuar."
            : "Não foi possível carregar seus horários agora.",
      },
      status: "error",
    };
  }
}

function getErrorCode(error: unknown): TherapistScheduleErrorCode {
  if (error instanceof TherapistScheduleAccessError) return "forbidden";
  if (error instanceof TherapistScheduleContractError) {
    return "invalid_contract";
  }
  if (error instanceof SupabaseServerRestError) {
    if (error.status === 401) return "session_expired";
    if (error.status === 403 || error.status === 404) return "forbidden";
  }
  return "unavailable";
}

class TherapistScheduleAccessError extends Error {}
