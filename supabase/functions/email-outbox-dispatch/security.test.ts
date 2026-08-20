import { isHmlProject, safeEqual, toDispatchLimit } from "./security.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("outbox dispatch permits only bounded batches", () => {
  assertEquals(toDispatchLimit(25), 25);
  assertEquals(toDispatchLimit(0), 10);
  assertEquals(toDispatchLimit(51), 10);
});

Deno.test("HML-only failure hook cannot activate for another project", () => {
  assertEquals(isHmlProject("https://emzwqkmrryuqvqiohqnu.supabase.co"), true);
  assertEquals(isHmlProject("https://aimtdvdpqtmrjfibsmvx.supabase.co"), false);
});

Deno.test("dispatch secrets require an exact match", () => {
  assertEquals(safeEqual("dispatch-secret", "dispatch-secret"), true);
  assertEquals(safeEqual("dispatch-secret", "dispatch-secret-2"), false);
  assertEquals(safeEqual(null, "dispatch-secret"), false);
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected)
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
}
