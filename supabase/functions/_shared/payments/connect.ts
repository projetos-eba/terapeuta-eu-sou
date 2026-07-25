import { TES_STRIPE_API_VERSION } from "./stripe-client.ts";

export function createRecipientAccountV2(input: {
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
      body: {
        configuration: {
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
        include: [
          "configuration.recipient",
          "defaults",
          "requirements",
          "future_requirements",
        ],
        metadata: {
          environment: input.environment,
          system: "tes",
          tes_therapist_id: input.therapistId,
        },
      },
      method: "POST",
    },
  );
}

export function retrieveAccountV2(apiKey: string, accountId: string) {
  const include = new URLSearchParams();
  include.append("include[0]", "configuration.recipient");
  include.append("include[1]", "defaults");
  include.append("include[2]", "requirements");
  include.append("include[3]", "future_requirements");

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
    method: "GET" | "POST";
  },
) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Stripe-Version": TES_STRIPE_API_VERSION,
    },
    method: options.method,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `STRIPE_V2_REQUEST_FAILED:${response.status}:${text.slice(0, 300)}`,
    );
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
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

export function deriveConnectAccountState(account: Record<string, unknown>) {
  const transfersStatus = getTransfersStatus(account);
  const pendingRequirements = getPendingRequirements(account);
  const closed = account.closed === true;
  const ready = !closed && transfersStatus === "active";

  return {
    disabledReason: closed ? "account_closed" : null,
    onboardingStatus: closed
      ? "disabled"
      : ready
        ? "ready"
        : pendingRequirements.currentlyDue.length > 0
          ? "requirements_due"
          : "restricted",
    operationalStatus: closed ? "disabled" : ready ? "ready" : "restricted",
    pendingRequirements,
    transfersStatus,
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
