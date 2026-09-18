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
import { queryTherapistSessionFeedback } from "./therapist-sessions.queries";

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
});
