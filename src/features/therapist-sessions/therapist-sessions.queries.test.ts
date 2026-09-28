import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server-rest", () => ({
  getSupabaseServerRestConfig: () => ({
    accessToken: "therapist-token",
    apiKey: "public-key",
    url: "https://tes.supabase.test",
  }),
  supabaseServerRestRpc: vi.fn().mockResolvedValue({
    status: "submitted",
    feedback: { authorRole: "therapist", successful: true },
  }),
}));

import { supabaseServerRestRpc } from "@/lib/supabase/server-rest";
import {
  queryTherapistSessionFeedback,
  queryTherapistSessions,
} from "./therapist-sessions.queries";

afterEach(() => vi.clearAllMocks());
describe("therapist quality feedback query", () => {
  it("reads the attempt-scoped quality response with the current therapist token", async () => {
    await expect(
      queryTherapistSessionFeedback("therapist-token", "booking-1"),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(supabaseServerRestRpc).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "therapist-token" }),
      "get_session_quality_feedback_v1",
      { p_booking_id: "booking-1" },
    );
  });

  it("keeps future terminal sessions visible only when the server page requests them", async () => {
    await queryTherapistSessions("therapist-token", {
      includeFutureTerminal: true,
      limit: 5,
      periodEnd: "2026-09-28T12:00:00.000Z",
    });

    expect(supabaseServerRestRpc).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "therapist-token" }),
      "get_therapist_sessions_v2",
      expect.objectContaining({
        p_include_future_terminal: true,
        p_limit: 5,
        p_period_end: "2026-09-28T12:00:00.000Z",
      }),
    );
  });
});
