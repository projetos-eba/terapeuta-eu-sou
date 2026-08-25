import {
  assertConnectAccountOwnership,
  buildRecipientAccountIdempotencyKey,
  buildRecipientAccountV2Payload,
  deriveConnectAccountState,
  derivePayoutSettingsState,
  getCardPaymentsStatus,
  getPendingRequirements,
  getTransfersStatus,
  isManualPayoutScheduleUnavailable,
} from "./connect.ts";

Deno.test("Connect ownership requires TES therapist and Stripe environment metadata", () => {
  const account = {
    metadata: {
      environment: "test",
      system: "tes",
      tes_therapist_id: "therapist-1",
    },
  };

  assertConnectAccountOwnership(account, {
    environment: "test",
    therapistProfileId: "therapist-1",
  });
  assertThrows(
    () => assertConnectAccountOwnership(account, {
      environment: "live",
      therapistProfileId: "therapist-1",
    }),
    Error,
    "Conta Connect nao pertence",
  );
});

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("Connect v2 separates transfer capability from payout readiness", () => {
  const account = accountWithTransferStatus("active", "active");
  const state = deriveConnectAccountState(account);

  assertEquals(getTransfersStatus(account), "active");
  assertEquals(getCardPaymentsStatus(account), "active");
  assertEquals(state.onboardingStatus, "ready");
  assertEquals(state.operationalStatus, "ready");
  assertEquals(state.chargesEnabled, true);
  assertEquals(state.payoutsEnabled, false);

  const ready = deriveConnectAccountState(account, {
    interval: "daily",
    payoutStatus: "enabled",
    payoutsEnabled: true,
  });
  assertEquals(ready.payoutsEnabled, true);
  assertEquals(ready.payoutScheduleInterval, "daily");
});

Deno.test("Balance Settings is the authority for payout readiness", () => {
  const state = derivePayoutSettingsState({
    payments: { payouts: { schedule: { interval: "daily" }, status: "enabled" } },
  });
  assertEquals(state.payoutStatus, "enabled");
  assertEquals(state.interval, "daily");
  assertEquals(state.payoutsEnabled, true);
});

Deno.test("Connect classifies provider refusal of a manual payout schedule", () => {
  assertEquals(
    isManualPayoutScheduleUnavailable({
      message: "You cannot be on a manual payout plan in country BR.",
      type: "StripeInvalidRequestError",
    }),
    true,
  );
  assertEquals(
    isManualPayoutScheduleUnavailable({ message: "Network unavailable" }),
    false,
  );
});

Deno.test("Connect v2 user requirements restrict the account", () => {
  const account = {
    ...accountWithTransferStatus("restricted", "restricted"),
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

Deno.test(
  "Connect v2 future requirements stay visible without marking the account as ready",
  () => {
    const account = {
      ...accountWithTransferStatus("inactive", "inactive"),
      requirements: {
        entries: [
          {
            awaiting_action_from: "user",
            description: "business_profile.url",
            impact: {
              restricts_capabilities: [
                { deadline: { status: "eventually_due" } },
              ],
            },
          },
        ],
      },
    };
    const requirements = getPendingRequirements(account);
    const state = deriveConnectAccountState(account);

    assertEquals(requirements.eventuallyDue.length, 1);
    assertEquals(requirements.eventuallyDue[0], "business_profile.url");
    assertEquals(state.onboardingStatus, "restricted");
    assertEquals(state.operationalStatus, "restricted");
  },
);

Deno.test("closed Connect v2 account is disabled", () => {
  const state = deriveConnectAccountState({
    ...accountWithTransferStatus("active"),
    closed: true,
  });

  assertEquals(state.disabledReason, "account_closed");
  assertEquals(state.onboardingStatus, "disabled");
  assertEquals(state.operationalStatus, "disabled");
});

Deno.test("Connect v2 recipient payload includes required identity country", () => {
  const payload = buildRecipientAccountV2Payload({
    email: "ana.oliveira@example.test",
    environment: "test",
    therapistId: "c1000000-0000-4000-8000-000000000001",
    therapistName: "Ana Oliveira",
  }) as {
    configuration?: {
      merchant?: {
        capabilities?: {
          card_payments?: { requested?: boolean };
        };
      };
      recipient?: {
        capabilities?: {
          stripe_balance?: {
            stripe_transfers?: { requested?: boolean };
          };
        };
      };
    };
    identity?: { country?: string; entity_type?: string };
    include?: string[];
  };

  assertEquals(payload.identity?.country, "br");
  assertEquals(payload.identity?.entity_type, "individual");
  assertEquals(
    payload.configuration?.merchant?.capabilities?.card_payments?.requested,
    true,
  );
  assertEquals(
    payload.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.requested,
    true,
  );
  assertEquals(payload.include?.includes("identity"), true);
});

Deno.test("Connect v2 account creation idempotency key is stable per therapist environment", () => {
  const key = buildRecipientAccountIdempotencyKey({
    environment: "test",
    therapistId: "c1000000-0000-4000-8000-000000000001",
  });

  assertEquals(
    key,
    "tes-connect-recipient-v3-test-c1000000-0000-4000-8000-000000000001",
  );
});

function accountWithTransferStatus(
  transfersStatus: string,
  cardPaymentsStatus = "inactive",
) {
  return {
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { status: cardPaymentsStatus },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: transfersStatus },
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

function assertThrows(
  callback: () => unknown,
  expectedType: typeof Error,
  expectedMessage: string,
) {
  try {
    callback();
  } catch (error) {
    if (
      error instanceof expectedType &&
      error.message.includes(expectedMessage)
    ) return;
    throw error;
  }
  throw new Error("Expected callback to throw.");
}
