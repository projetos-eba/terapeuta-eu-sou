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
  return stripeV2Request<Record<string, unknown>>(
    apiKey,
    `/v2/core/accounts/${encodeURIComponent(accountId)}`,
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
  const currentlyDue = requirements.currently_due;
  const eventuallyDue = requirements.eventually_due;

  return {
    currentlyDue: Array.isArray(currentlyDue) ? currentlyDue : [],
    eventuallyDue: Array.isArray(eventuallyDue) ? eventuallyDue : [],
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
