import { describe, expect, it } from "vitest";

import {
  selectRetentionSlots,
  type RescheduleSlot,
} from "./session-change-dialog";

describe("selectRetentionSlots", () => {
  it("distributes at most two suggestions across up to three dates", () => {
    const slots: RescheduleSlot[] = [
      slot("2026-09-08T12:00:00.000Z"),
      slot("2026-09-08T13:00:00.000Z"),
      slot("2026-09-08T21:00:00.000Z"),
      slot("2026-09-09T12:00:00.000Z"),
      slot("2026-09-09T20:00:00.000Z"),
      slot("2026-09-10T12:00:00.000Z"),
      slot("2026-09-10T19:00:00.000Z"),
      slot("2026-09-11T12:00:00.000Z"),
    ];

    const selected = selectRetentionSlots(
      slots,
      "2026-09-07T13:00:00.000Z",
      "America/Sao_Paulo",
    );

    expect(selected).toHaveLength(6);
    const counts = selected.reduce<Record<string, number>>((result, item) => {
      const date = item.startsAt.slice(0, 10);
      result[date] = (result[date] ?? 0) + 1;
      return result;
    }, {});
    expect(Object.keys(counts)).toHaveLength(3);
    expect(Math.max(...Object.values(counts))).toBe(2);
  });
});

function slot(startsAt: string): RescheduleSlot {
  return {
    endsAt: new Date(Date.parse(startsAt) + 50 * 60_000).toISOString(),
    startsAt,
  };
}
