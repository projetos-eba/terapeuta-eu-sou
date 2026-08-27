import { calculateCommissionSnapshot } from "./money.ts";

Deno.test("default session commission retains 15 percent for TES", () => {
  assertEquals(
    calculateCommissionSnapshot({ grossAmountCents: 20_000 }),
    {
      grossAmountCents: 20_000,
      platformCommissionBps: 1_500,
      platformGrossCommissionCents: 3_000,
      therapistAmountCents: 17_000,
    },
  );
});

Deno.test("explicit historical commission snapshots remain supported", () => {
  assertEquals(
    calculateCommissionSnapshot({
      grossAmountCents: 20_000,
      platformCommissionBps: 2_000,
    }),
    {
      grossAmountCents: 20_000,
      platformCommissionBps: 2_000,
      platformGrossCommissionCents: 4_000,
      therapistAmountCents: 16_000,
    },
  );
});

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}
