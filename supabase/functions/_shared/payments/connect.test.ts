import {
  deriveConnectAccountState,
  getPendingRequirements,
  getTransfersStatus,
} from "./connect.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("Connect v2 active transfer capability is ready", () => {
  const account = accountWithTransferStatus("active");
  const state = deriveConnectAccountState(account);

  assertEquals(getTransfersStatus(account), "active");
  assertEquals(state.onboardingStatus, "ready");
  assertEquals(state.operationalStatus, "ready");
});

Deno.test("Connect v2 user requirements restrict the account", () => {
  const account = {
    ...accountWithTransferStatus("restricted"),
    requirements: {
      entries: [
        {
          awaiting_action_from: "user",
          description: "identity.document",
          impact: {
            restricts_capabilities: [{ deadline: { status: "currently_due" } }],
          },
        },
        {
          awaiting_action_from: "stripe",
          description: "identity.verification",
          impact: {
            restricts_capabilities: [{ deadline: { status: "currently_due" } }],
          },
        },
      ],
    },
  };
  const requirements = getPendingRequirements(account);
  const state = deriveConnectAccountState(account);

  assertEquals(requirements.currentlyDue.length, 1);
  assertEquals(requirements.currentlyDue[0], "identity.document");
  assertEquals(state.onboardingStatus, "requirements_due");
});

Deno.test("closed Connect v2 account is disabled", () => {
  const state = deriveConnectAccountState({
    ...accountWithTransferStatus("active"),
    closed: true,
  });

  assertEquals(state.disabledReason, "account_closed");
  assertEquals(state.onboardingStatus, "disabled");
  assertEquals(state.operationalStatus, "disabled");
});

function accountWithTransferStatus(status: string) {
  return {
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status },
          },
        },
      },
    },
  };
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
