import { beforeEach, describe, expect, it, vi } from "vitest";

const queryTherapistBlocks = vi.hoisted(() => vi.fn());

vi.mock("./therapist-blocks.queries", () => ({
  queryTherapistBlocks,
}));

import { getTherapistBlocks } from "./therapist-blocks.service";

describe("getTherapistBlocks", () => {
  beforeEach(() => {
    queryTherapistBlocks.mockReset();
  });

  it("loads every cursor page before the monthly overview is rendered", async () => {
    const firstPageBlocks = Array.from({ length: 20 }, (_, index) =>
      block(index + 1),
    );
    const secondPageBlocks = Array.from({ length: 10 }, (_, index) =>
      block(index + 21),
    );
    const cursor = {
      id: firstPageBlocks.at(-1)?.id,
      startsAt: firstPageBlocks.at(-1)?.startsAt,
    };

    queryTherapistBlocks
      .mockResolvedValueOnce(readModel(firstPageBlocks, cursor))
      .mockResolvedValueOnce(readModel(secondPageBlocks, null));

    const result = await getTherapistBlocks({
      accessToken: "access-token",
      filters: { status: "active" },
      profileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(result).toMatchObject({ status: "success" });
    if (result.status !== "success") throw new Error("expected success");

    expect(result.data.blocks).toHaveLength(30);
    expect(result.data.blocks.at(-1)?.startsAt).toBe(
      "2026-10-30T03:00:00.000Z",
    );
    expect(result.data.nextCursor).toBeNull();
    expect(queryTherapistBlocks).toHaveBeenCalledTimes(2);
    expect(queryTherapistBlocks).toHaveBeenNthCalledWith(
      2,
      "access-token",
      expect.objectContaining({
        cursorId: cursor.id,
        cursorStartsAt: cursor.startsAt,
        status: "active",
      }),
    );
  });
});

function block(day: number) {
  const date = String(day).padStart(2, "0");
  return {
    allDay: true,
    createdAt: "2026-09-30T12:00:00.000Z",
    endsAt: `2026-10-${date}T03:00:00.000Z`,
    id: `a4100000-0000-4000-8000-${String(day).padStart(12, "0")}`,
    impactedBookings: [],
    reason: "Férias",
    reasonCode: "vacation",
    recurrenceEndsOn: "2026-10-30",
    recurrenceFrequency: "daily",
    seriesId: "a4000000-0000-4000-8000-000000000001",
    serviceId: null,
    serviceTitle: null,
    startsAt: `2026-10-${date}T03:00:00.000Z`,
    status: "active",
    timezone: "America/Sao_Paulo",
    version: 1,
  };
}

function readModel(
  blocks: ReturnType<typeof block>[],
  nextCursor: { id: string | undefined; startsAt: string | undefined } | null,
) {
  return {
    blocks,
    contractVersion: 1,
    nextCursor,
    scheduleVersion: 2,
    summary: {
      activeBlocks: 30,
      pendingImpacts: 0,
      recurringSeries: 1,
    },
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    timezone: "America/Sao_Paulo",
  };
}
