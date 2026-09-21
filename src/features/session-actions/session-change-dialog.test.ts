import { describe, expect, it } from "vitest";

import {
  getSessionChangeDialogDescription,
  groupNextAvailableSlots,
  type RescheduleSlot,
} from "./session-change-dialog";

describe("groupNextAvailableSlots", () => {
  it("uses the complete next-slot presentation for rescheduling and cancellation retention", () => {
    const slots: RescheduleSlot[] = [
      slot("2026-09-08T12:00:00.000Z"),
      slot("2026-09-08T13:00:00.000Z"),
      slot("2026-09-08T14:00:00.000Z"),
      slot("2026-09-08T15:00:00.000Z"),
      slot("2026-09-08T16:00:00.000Z"),
      slot("2026-09-08T21:00:00.000Z"),
      slot("2026-09-09T12:00:00.000Z"),
      slot("2026-09-09T13:00:00.000Z"),
      slot("2026-09-09T14:00:00.000Z"),
      slot("2026-09-09T15:00:00.000Z"),
      slot("2026-09-09T20:00:00.000Z"),
      slot("2026-09-10T12:00:00.000Z"),
      slot("2026-09-10T13:00:00.000Z"),
      slot("2026-09-10T14:00:00.000Z"),
      slot("2026-09-10T15:00:00.000Z"),
      slot("2026-09-10T19:00:00.000Z"),
      slot("2026-09-11T12:00:00.000Z"),
    ];

    const groups = groupNextAvailableSlots(slots, "America/Sao_Paulo");

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.slots)).toEqual([
      slots.slice(0, 5),
      slots.slice(6, 11),
      slots.slice(11, 16),
    ]);
  });
});

describe("getSessionChangeDialogDescription", () => {
  it("does not suggest a refund before the therapist proposes a pre-charge change", () => {
    expect(
      getSessionChangeDialogDescription({
        actorRole: "therapist",
        mode: "reschedule",
        screen: "therapist_change",
      }),
    ).toBe(
      "A pessoa poderá escolher outro horário disponível ou cancelar a sessão.",
    );
  });
});

function slot(startsAt: string): RescheduleSlot {
  return {
    endsAt: new Date(Date.parse(startsAt) + 50 * 60_000).toISOString(),
    startsAt,
  };
}
