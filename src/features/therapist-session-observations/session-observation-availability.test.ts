import { describe, expect, it } from "vitest";

import { isSessionObservationEligible } from "./session-observation-availability";

describe("isSessionObservationEligible", () => {
  const now = Date.parse("2026-09-24T15:00:00.000Z");

  it("allows a non-cancelled session after its scheduled end", () => {
    expect(
      isSessionObservationEligible({
        bookingStatus: "confirmed",
        endsAt: "2026-09-24T14:59:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it.each(["cancelled_by_patient", "cancelled_by_therapist", "refunded"])(
    "keeps %s unavailable",
    (bookingStatus) => {
      expect(
        isSessionObservationEligible({
          bookingStatus,
          endsAt: "2026-09-24T14:59:00.000Z",
          now,
        }),
      ).toBe(false);
    },
  );

  it("keeps future sessions unavailable", () => {
    expect(
      isSessionObservationEligible({
        bookingStatus: "confirmed",
        endsAt: "2026-09-24T15:01:00.000Z",
        now,
      }),
    ).toBe(false);
  });
});
