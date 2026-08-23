import { isTherapistReceivingAccountReady } from "./http.ts";

Deno.test("receiving account readiness requires submitted details", () => {
  assertEquals(
    isTherapistReceivingAccountReady({
      details_submitted: false,
      onboarding_status: "account_created",
      pending_requirements: [],
      stripe_transfers_status: "inactive",
    }),
    false,
  );
});

Deno.test("receiving account readiness blocks due requirements and restrictions", () => {
  for (const account of [
    {
      details_submitted: true,
      onboarding_status: "requirements_due",
      pending_requirements: { currently_due: ["external_account"] },
      stripe_transfers_status: "inactive",
    },
    {
      details_submitted: true,
      onboarding_status: "restricted",
      pending_requirements: [],
      stripe_transfers_status: "inactive",
    },
  ]) {
    assert(!isTherapistReceivingAccountReady(account));
  }
});

function assert(value: unknown) {
  if (!value) throw new Error("Expected condition to be true.");
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

Deno.test("receiving account readiness accepts submitted review and active accounts", () => {
  assert(
    isTherapistReceivingAccountReady({
      details_submitted: true,
      onboarding_status: "onboarding_started",
      pending_requirements: { eventuallyDue: ["future_requirement"] },
      stripe_transfers_status: "pending",
    }),
  );
  assert(
    isTherapistReceivingAccountReady({
      details_submitted: true,
      onboarding_status: "ready",
      pending_requirements: [],
      stripe_transfers_status: "active",
    }),
  );
});
