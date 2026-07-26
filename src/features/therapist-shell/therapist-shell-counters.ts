import "server-only";

import {
  parseTherapistShellCounters,
  SessionReadModelContractError,
  type TherapistShellCounters,
} from "@/features/bookings";
import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import {
  getSupabaseServerRestConfig,
  SupabaseServerRestError,
  supabaseServerRestRpc,
} from "@/lib/supabase/server-rest";

const emptyCounters: Omit<
  TherapistShellCounters,
  "therapistProfileId" | "version"
> = {
  impactedBookings: 0,
  pendingPayments: 0,
  pendingRescheduleRequests: 0,
  pendingReviewReplies: 0,
  unreadMessages: 0,
  unreadNotifications: 0,
};

export async function getTherapistShellCounters(input: {
  accessToken: string;
  profileId: string;
}) {
  const correlationId = createCorrelationId();
  const startedAt = performance.now();

  try {
    const config = getSupabaseServerRestConfig(input.accessToken);
    if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");
    const response = await supabaseServerRestRpc<unknown>(
      config,
      "get_therapist_shell_counters_v1",
    );
    const counters = parseTherapistShellCounters(response);

    if (counters.therapistProfileId !== input.profileId) {
      throw new ShellCounterAccessError();
    }

    return counters;
  } catch (error) {
    const errorCode =
      error instanceof SupabaseServerRestError
        ? `supabase_${error.status ?? "unavailable"}`
        : error instanceof SessionReadModelContractError
          ? "invalid_contract"
          : error instanceof ShellCounterAccessError
            ? "forbidden"
            : "unavailable";
    logServerOperationFailure({
      actorRole: "therapist",
      correlationId,
      durationMs: performance.now() - startedAt,
      errorCode,
      externalStatus:
        error instanceof SupabaseServerRestError ? error.status : undefined,
      operation: "get_therapist_shell_counters_v1",
    });

    return {
      ...emptyCounters,
      therapistProfileId: input.profileId,
      version: 1 as const,
    };
  }
}

class ShellCounterAccessError extends Error {}
