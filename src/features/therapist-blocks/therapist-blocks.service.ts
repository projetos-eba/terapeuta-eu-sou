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
    const data = await getCompleteTherapistBlocks(
      input.accessToken,
      input.filters,
    );

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

async function getCompleteTherapistBlocks(
  accessToken: string,
  filters: TherapistBlocksFilters | undefined,
): Promise<TherapistBlocksReadModel> {
  const firstPage = parseTherapistBlocksReadModel(
    await queryTherapistBlocks(accessToken, filters),
  );

  // The database cursor is not scoped to free-text search. Preserve the
  // existing server-side search page until that database contract can carry
  // the search predicate through every cursor page.
  if (filters?.search?.trim()) return firstPage;

  const blocks = [...firstPage.blocks];
  const cursors = new Set<string>();
  let cursor = firstPage.nextCursor;

  while (cursor) {
    const cursorKey = `${cursor.startsAt}:${cursor.id}`;
    if (cursors.has(cursorKey)) throw new TherapistBlocksContractError();
    cursors.add(cursorKey);

    const page = parseTherapistBlocksReadModel(
      await queryTherapistBlocks(accessToken, {
        ...filters,
        cursorId: cursor.id,
        cursorStartsAt: cursor.startsAt,
      }),
    );

    if (
      page.therapistProfileId !== firstPage.therapistProfileId ||
      page.scheduleVersion !== firstPage.scheduleVersion ||
      page.timezone !== firstPage.timezone
    ) {
      throw new TherapistBlocksContractError();
    }

    blocks.push(...page.blocks);
    cursor = page.nextCursor;
  }

  return { ...firstPage, blocks, nextCursor: null };
}
