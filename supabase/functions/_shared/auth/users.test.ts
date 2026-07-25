import { redirectAfterEmailConfirmation } from "./users.ts";
import type { SupabaseRestClient } from "./supabase-rest.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("redirectAfterEmailConfirmation keeps patient redirects simple", async () => {
  const client = mockClient([]);

  const redirectTo = await redirectAfterEmailConfirmation(
    client,
    "patient",
    "user-1",
    "?verified=1",
  );

  assertEquals(redirectTo, "/cliente/login?verified=1");
});

Deno.test("redirectAfterEmailConfirmation sends paid therapist requests back to checkout", async () => {
  const client = mockClient([
    {
      metadata: {
        signup: {
          requestedPlan: "premium_plus",
        },
      },
    },
  ]);

  const redirectTo = await redirectAfterEmailConfirmation(
    client,
    "therapist",
    "user-1",
    "?verified=1",
  );

  assertEquals(
    redirectTo,
    "/terapeuta/login?verified=1&next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium_plus",
  );
});

Deno.test("redirectAfterEmailConfirmation ignores invalid therapist requested plans", async () => {
  const client = mockClient([
    {
      metadata: {
        signup: {
          requestedPlan: "free",
        },
      },
    },
  ]);

  const redirectTo = await redirectAfterEmailConfirmation(
    client,
    "therapist",
    "user-1",
    "?verified=1",
  );

  assertEquals(redirectTo, "/terapeuta/login?verified=1");
});

function mockClient(rows: unknown[]) {
  return {
    get: async () => rows,
  } as unknown as SupabaseRestClient;
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
