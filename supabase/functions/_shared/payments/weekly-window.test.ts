import { resolveWeeklyPayoutStartWindow } from "./weekly-window.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("weekly payout window opens Tuesday from 02:00 to 03:59 BRT", () => {
  assertEquals(resolveWeeklyPayoutStartWindow("2026-09-01T05:00:00.000Z"), {
    businessDate: "2026-09-01",
    open: true,
  });
  assertEquals(resolveWeeklyPayoutStartWindow("2026-09-01T06:59:59.000Z"), {
    businessDate: "2026-09-01",
    open: true,
  });
});

Deno.test(
  "weekly payout window stays closed outside Tuesday start window",
  () => {
    assertEquals(resolveWeeklyPayoutStartWindow("2026-09-01T04:59:59.000Z"), {
      businessDate: "2026-09-01",
      open: false,
    });
    assertEquals(resolveWeeklyPayoutStartWindow("2026-09-01T07:00:00.000Z"), {
      businessDate: "2026-09-01",
      open: false,
    });
    assertEquals(resolveWeeklyPayoutStartWindow("2026-09-03T18:00:00.000Z"), {
      businessDate: "2026-09-03",
      open: false,
    });
  },
);

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}
