import { TES_STRIPE_API_VERSION } from "./stripe-client.ts";
import type { StripeClient } from "./stripe-client.ts";

export type ConnectPayoutSettingsState = {
  interval: "daily" | "manual" | "monthly" | "weekly" | null;
  payoutStatus: "disabled" | "enabled";
  payoutsEnabled: boolean;
};

export function assertConnectAccountOwnership(
  account: Record<string, unknown>,
  input: { environment: "live" | "test"; therapistProfileId: string },
) {
  const metadata = asRecord(account.metadata);
  if (
    metadata.system !== "tes" ||
    metadata.tes_therapist_id !== input.therapistProfileId ||
    metadata.environment !== input.environment
  ) {
    throw Object.assign(new Error("Conta Connect nao pertence ao contexto informado."), {
      code: "connect_account_ownership_mismatch",
      statusCode: 422,
    });
  }
}

export function createRecipientAccountV2(input: {
  accountGeneration: number;
  apiKey: string;
  email?: string | null;
  environment: string;
  therapistId: string;
  therapistName: string;
}) {
  return stripeV2Request<Record<string, unknown>>(
    input.apiKey,
    "/v2/core/accounts",
    {
      body: buildRecipientAccountV2Payload(input),
      idempotencyKey: buildRecipientAccountIdempotencyKey(input),
      method: "POST",
    },
  );
}

export function buildRecipientAccountIdempotencyKey(input: {
  accountGeneration: number;
  environment: string;
  therapistId: string;
}) {
  return `tes-connect-recipient-v4-${input.environment}-${input.therapistId}-${input.accountGeneration}`;
}

export function buildRecipientAccountV2Payload(input: {
  accountGeneration: number;
  email?: string | null;
  environment: string;
  therapistId: string;
  therapistName: string;
}) {
  return {
    configuration: {
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    contact_email: input.email ?? undefined,
    dashboard: "express",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    display_name: input.therapistName,
    identity: {
      country: "br",
      entity_type: "individual",
    },
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "defaults",
      "identity",
      "requirements",
      "future_requirements",
    ],
    metadata: {
      account_generation: String(input.accountGeneration),
      environment: input.environment,
      system: "tes",
      tes_therapist_id: input.therapistId,
    },
  };
}

export function retrieveAccountV2(apiKey: string, accountId: string) {
  const include = new URLSearchParams();
  include.append("include[0]", "configuration.recipient");
  include.append("include[1]", "configuration.merchant");
  include.append("include[2]", "defaults");
  include.append("include[3]", "identity");
  include.append("include[4]", "requirements");
  include.append("include[5]", "future_requirements");

  return stripeV2Request<Record<string, unknown>>(
    apiKey,
    `/v2/core/accounts/${encodeURIComponent(accountId)}?${include.toString()}`,
    { method: "GET" },
  );
}

async function stripeV2Request<T>(
  apiKey: string,
  path: string,
  options: {
    body?: unknown;
    idempotencyKey?: string;
    method: "GET" | "POST";
  },
) {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Stripe-Version": TES_STRIPE_API_VERSION,
  });

  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `STRIPE_V2_REQUEST_FAILED:${response.status}:${getStripeErrorCode(text)}`,
    );
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

function getStripeErrorCode(value: string) {
  try {
    const parsed = JSON.parse(value) as { error?: { code?: unknown } };
    return typeof parsed.error?.code === "string"
      ? parsed.error.code
      : "unknown";
  } catch {
    return "invalid_response";
  }
}

export function getTransfersStatus(account: Record<string, unknown>) {
  const configuration = asRecord(account.configuration);
  const recipient = asRecord(configuration.recipient);
  const capabilities = asRecord(recipient.capabilities);
  const stripeBalance = asRecord(capabilities.stripe_balance);
  const stripeTransfers = asRecord(stripeBalance.stripe_transfers);
  const status = stripeTransfers.status;

  return typeof status === "string" ? status : "inactive";
}

export function getCardPaymentsStatus(account: Record<string, unknown>) {
  const configuration = asRecord(account.configuration);
  const merchant = asRecord(configuration.merchant);
  const capabilities = asRecord(merchant.capabilities);
  const cardPayments = asRecord(capabilities.card_payments);
  const status = cardPayments.status;

  return typeof status === "string" ? status : "inactive";
}

export function getPendingRequirements(account: Record<string, unknown>) {
  const requirements = asRecord(account.requirements);
  const entries = Array.isArray(requirements.entries)
    ? requirements.entries.filter(isRecord)
    : [];
  const currentlyDue = requirements.currently_due;
  const eventuallyDue = requirements.eventually_due;

  if (entries.length > 0) {
    return {
      currentlyDue: entries
        .filter((entry) => {
          const deadline = getRequirementDeadlineStatus(entry);
          return (
            entry.awaiting_action_from === "user" &&
            (deadline === "currently_due" || deadline === "past_due")
          );
        })
        .map(getRequirementKey),
      eventuallyDue: entries
        .filter(
          (entry) =>
            entry.awaiting_action_from === "user" &&
            getRequirementDeadlineStatus(entry) === "eventually_due",
        )
        .map(getRequirementKey),
    };
  }

  return {
    currentlyDue: Array.isArray(currentlyDue) ? currentlyDue : [],
    eventuallyDue: Array.isArray(eventuallyDue) ? eventuallyDue : [],
  };
}

export function deriveConnectAccountState(
  account: Record<string, unknown>,
  payoutSettings: ConnectPayoutSettingsState = {
    interval: null,
    payoutStatus: "disabled",
    payoutsEnabled: false,
  },
) {
  const transfersStatus = getTransfersStatus(account);
  const cardPaymentsStatus = getCardPaymentsStatus(account);
  const pendingRequirements = getPendingRequirements(account);
  const closed = account.closed === true;
  const ready = !closed && transfersStatus === "active";

  return {
    chargesEnabled: cardPaymentsStatus === "active",
    disabledReason: closed ? "account_closed" : null,
    detailsSubmitted:
      !closed &&
      pendingRequirements.currentlyDue.length === 0 &&
      pendingRequirements.eventuallyDue.length === 0,
    onboardingStatus: closed
      ? "disabled"
      : ready
        ? "ready"
        : pendingRequirements.currentlyDue.length > 0
          ? "requirements_due"
          : "restricted",
    operationalStatus: closed ? "disabled" : ready ? "ready" : "restricted",
    pendingRequirements,
    payoutScheduleInterval: payoutSettings.interval,
    payoutStatus: payoutSettings.payoutStatus,
    payoutsEnabled: payoutSettings.payoutsEnabled,
    transfersStatus,
  };
}

export async function retrieveBalanceSettings(
  stripe: StripeClient,
  accountId: string,
) {
  return await stripe.balanceSettings.retrieve(
    {},
    { stripeContext: accountId },
  );
}

export async function setManualPayoutSchedule(
  stripe: StripeClient,
  accountId: string,
  idempotencyKey: string,
) {
  return await stripe.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: { interval: "manual" },
        },
      },
    },
    { idempotencyKey, stripeContext: accountId },
  );
}

export async function setDailyAutomaticPayoutSchedule(
  stripe: StripeClient,
  accountId: string,
  idempotencyKey: string,
) {
  return await stripe.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: { interval: "daily" },
        },
      },
    },
    { idempotencyKey, stripeContext: accountId },
  );
}

export function isManualPayoutScheduleUnavailable(error: unknown) {
  const value = asRecord(error);
  const raw = asRecord(value.raw);
  const message = [value.message, raw.message]
    .find((candidate): candidate is string => typeof candidate === "string") ?? "";

  return /cannot be on a manual payout plan|payout interval ["']manual["'] is not available/i
    .test(message);
}

export function derivePayoutSettingsState(
  settings: Record<string, unknown>,
): ConnectPayoutSettingsState {
  const payments = asRecord(settings.payments);
  const payouts = asRecord(payments.payouts);
  const schedule = asRecord(payouts.schedule);
  const status = payouts.status === "enabled" ? "enabled" : "disabled";
  const rawInterval = schedule.interval;
  const interval =
    rawInterval === "daily" ||
    rawInterval === "manual" ||
    rawInterval === "monthly" ||
    rawInterval === "weekly"
      ? rawInterval
      : null;

  return {
    interval,
    payoutStatus: status,
    payoutsEnabled: status === "enabled",
  };
}

export function getAccountId(account: Record<string, unknown>) {
  const id = account.id;

  if (typeof id !== "string") {
    throw new Error("STRIPE_ACCOUNT_ID_MISSING");
  }

  return id;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRequirementDeadlineStatus(entry: Record<string, unknown>) {
  const impact = asRecord(entry.impact);
  const restrictions = Array.isArray(impact.restricts_capabilities)
    ? impact.restricts_capabilities.filter(isRecord)
    : [];
  const statuses = restrictions
    .map((restriction) => asRecord(restriction.deadline).status)
    .filter((status): status is string => typeof status === "string");

  if (statuses.includes("past_due")) return "past_due";
  if (statuses.includes("currently_due")) return "currently_due";
  if (statuses.includes("eventually_due")) return "eventually_due";

  return null;
}

function getRequirementKey(entry: Record<string, unknown>) {
  if (typeof entry.description === "string") return entry.description;
  if (typeof entry.id === "string") return entry.id;

  return "requirement";
}
