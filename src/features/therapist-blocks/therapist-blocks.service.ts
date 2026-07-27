import "server-only";

import type { TherapistBlocksReadModel } from "@/domain/tes";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { SupabaseServerRestError } from "@/lib/supabase/server-rest";

import {
  type TherapistBlocksErrorCode,
  TherapistBlocksContractError,
} from "./therapist-blocks.errors";
import { parseTherapistBlocksReadModel } from "./therapist-blocks.parsers";
import {
  queryTherapistBlocks,
  type TherapistBlocksFilters,
} from "./therapist-blocks.queries";

export type TherapistBlocksResult =
  | { data: TherapistBlocksReadModel; status: "success" }
  | {
      data: null;
      error: {
        code: TherapistBlocksErrorCode;
        correlationId: string;
        message: string;
      };
      status: "error";
    };

export async function getTherapistBlocks(input: {
  accessToken: string;
  filters?: TherapistBlocksFilters;
  profileId: string;
}): Promise<TherapistBlocksResult> {
  const correlationId = createCorrelationId();
  const startedAt = performance.now();

  try {
    const response = await queryTherapistBlocks(
      input.accessToken,
      input.filters,
    );
    const data = parseTherapistBlocksReadModel(response);

    if (data.therapistProfileId !== input.profileId) {
      throw new TherapistBlocksAccessError();
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
      operation: "get_therapist_blocks_v1",
    });

    return {
      data: null,
      error: {
        code,
        correlationId,
        message:
          code === "session_expired"
            ? "Sua sessão expirou. Entre novamente para continuar."
            : code === "invalid_filter"
              ? "Revise os filtros de bloqueios."
              : "Não foi possível carregar os bloqueios agora.",
      },
      status: "error",
    };
  }
}

function getErrorCode(error: unknown): TherapistBlocksErrorCode {
  if (error instanceof TherapistBlocksAccessError) return "forbidden";
  if (error instanceof TherapistBlocksContractError) return "invalid_contract";
  if (error instanceof SupabaseServerRestError) {
    if (error.status === 401) return "session_expired";
    if (error.status === 403 || error.status === 404) return "forbidden";
    if (error.status === 400) return "invalid_filter";
  }
  return "unavailable";
}

class TherapistBlocksAccessError extends Error {}
