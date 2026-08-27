import { describe, expect, it } from "vitest";

import { canUseTherapistCapability } from "@/domain/tes";

import { getTherapistPostSessionAction } from "./session-feedback-action";

describe("getTherapistPostSessionAction", () => {
  const now = Date.parse("2026-08-27T15:00:00.000Z");

  it("keeps room actions before the scheduled end", () => {
    expect(
      getTherapistPostSessionAction({
        endsAt: "2026-08-27T15:01:00.000Z",
        feedbackStatus: "eligible",
        now,
      }),
    ).toBe("room");
  });

  it("replaces room actions with confirmation when feedback is eligible", () => {
    expect(
      getTherapistPostSessionAction({
        endsAt: "2026-08-27T14:59:00.000Z",
        feedbackStatus: "eligible",
        now,
      }),
    ).toBe("confirm");
  });

  it("keeps submitted and unavailable confirmations as status-only states", () => {
    expect(
      getTherapistPostSessionAction({
        endsAt: "2026-08-27T14:59:00.000Z",
        feedbackStatus: "submitted",
        now,
      }),
    ).toBe("submitted");
    expect(
      getTherapistPostSessionAction({
        endsAt: "2026-08-27T14:59:00.000Z",
        feedbackStatus: "unavailable",
        now,
      }),
    ).toBe("unavailable");
  });

  it("keeps the operational sessions capability available to Free", () => {
    expect(canUseTherapistCapability("free", "operation_essentials")).toBe(
      true,
    );
  });
});
