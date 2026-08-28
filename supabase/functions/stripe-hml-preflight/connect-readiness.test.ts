import { assertEquals } from "jsr:@std/assert";

import {
  type ConnectReadinessState,
  evaluateConnectReadiness,
} from "./connect-readiness.ts";

const ready: ConnectReadinessState = {
  operationalStatus: "ready",
  payoutScheduleInterval: "daily",
  payoutStatus: "enabled",
  payoutsEnabled: true,
  transfersStatus: "active",
};

const restricted: ConnectReadinessState = {
  operationalStatus: "restricted",
  payoutScheduleInterval: "daily",
  payoutStatus: "disabled",
  payoutsEnabled: false,
  transfersStatus: "restricted",
};

Deno.test("accepts a current account whose remote and local readiness match", () => {
  assertEquals(
    evaluateConnectReadiness({
      hasPositiveFinancialHistory: true,
      local: ready,
      remote: ready,
    }),
    { kind: "ready", reason: "ready" },
  );
});

Deno.test("fails closed when the local snapshot is stale", () => {
  assertEquals(
    evaluateConnectReadiness({
      hasPositiveFinancialHistory: false,
      local: ready,
      remote: restricted,
    }),
    { kind: "blocked", reason: "snapshot_mismatch" },
  );
});

Deno.test("isolates a restricted current account only without positive financial history", () => {
  assertEquals(
    evaluateConnectReadiness({
      hasPositiveFinancialHistory: false,
      local: restricted,
      remote: restricted,
    }),
    { kind: "isolated", reason: "no_financial_history" },
  );
});

Deno.test("blocks a restricted current account with positive financial history", () => {
  assertEquals(
    evaluateConnectReadiness({
      hasPositiveFinancialHistory: true,
      local: restricted,
      remote: restricted,
    }),
    { kind: "blocked", reason: "blocking_financial_history" },
  );
});
