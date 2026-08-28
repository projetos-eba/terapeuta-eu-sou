import { getServiceRoleKey, type EdgeRuntime } from "../auth/runtime.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../auth/supabase-rest.ts";
import { HostingerMailApiProvider } from "./hostinger-mail-api-provider.ts";
import {
  realEmailCooldownRemainingMs,
  resolveSingleRealEmailActionKey,
} from "./real-email-test-policy.ts";
import { emailActionRegistry } from "./registry.ts";
import { sendTransactionalEmail } from "./service.ts";
import type {
  EmailActionKey,
  EmailProviderSender,
  SenderProfileRow,
  UserRole,
} from "./types.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  exit(code?: number): never;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readTextFile(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  writeTextFile(
    path: string,
    data: string,
    options?: { createNew?: boolean },
  ): Promise<void>;
};

const ALLOWED_RECIPIENTS = new Set([
  "viniciusferrari.silva@gmail.com",
  "ferrarimarketing9@gmail.com",
]);
const SEND_GATE_PATH = ".tmp/email-real-test-send-gate.json";

const runtime: EdgeRuntime = {
  env: Deno.env,
  serve() {
    throw new Error("Serve is not used by the real email test.");
  },
};

const recipient = Deno.env.get("EMAIL_E2E_RECIPIENT")?.trim().toLowerCase();
const allow = Deno.env.get("ALLOW_REAL_EMAIL_TESTS")?.trim().toLowerCase();
const supabaseUrl =
  Deno.env.get("SUPABASE_URL")?.trim() ??
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")?.trim();
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
  getServiceRoleKey(runtime);
const apiKey = Deno.env.get("EMAIL_SERVER_API_KEY")?.trim();

if (allow !== "true") {
  fail("ALLOW_REAL_EMAIL_TESTS must be true.");
}

if (!recipient || !ALLOWED_RECIPIENTS.has(recipient)) {
  fail("EMAIL_E2E_RECIPIENT is not the approved recipient.");
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Supabase admin environment is not configured.");
}

if (!apiKey) {
  fail("EMAIL_SERVER_API_KEY is not configured.");
}

const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
const provider = new HostingerMailApiProvider({ apiKey, maxAttempts: 1 });
const actionKey = resolveRequestedActionKey();
const syncedSender = await runStep("sync_hostinger_senders", () =>
  syncHostingerSenders(client, provider),
);
const entry = emailActionRegistry[actionKey];
await acquirePersistentSendGate(actionKey);
const result = await runStep(`send_real_email:${entry.actionKey}`, () =>
  sendTransactionalEmail(client, provider, {
    actionKey: entry.actionKey,
    correlationId: `email-e2e-${entry.actionKey}-${crypto.randomUUID()}`,
    deliverySnapshot: {
      senderProfileId: syncedSender.id,
      templateOverrides: {},
      templateVersion: entry.currentTemplateVersion,
    },
    dispatchMode: "manual",
    recipient: {
      email: recipient,
      name: "Teste TES",
    },
    recipientRole: recipientRoleFor(entry.actionKey),
    templateData: entry.previewFixture,
  }),
);

console.log(`${entry.actionKey}: ${result.status}`);

if (result.status !== "success") {
  fail(`Real email test was not accepted for ${entry.actionKey}.`);
}

console.log(
  `Real email test accepted exactly one message for the approved recipient from ${syncedSender.mailbox_address}.`,
);

function recipientRoleFor(actionKey: EmailActionKey): UserRole | null {
  if (actionKey === "payout_operational_alert_admin") return "admin";
  if (
    actionKey.includes("therapist") ||
    actionKey.startsWith("therapy_catalog_request_")
  ) {
    return "therapist";
  }
  if (
    actionKey.includes("patient") ||
    actionKey.startsWith("session_") ||
    actionKey === "patient_welcome"
  ) {
    return "patient";
  }
  return null;
}

function resolveRequestedActionKey() {
  try {
    return resolveSingleRealEmailActionKey(
      Deno.env.get("EMAIL_E2E_ACTION_KEYS"),
      Object.keys(emailActionRegistry),
    ) as EmailActionKey;
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid real email action.");
  }
}

async function acquirePersistentSendGate(actionKey: EmailActionKey) {
  await Deno.mkdir(".tmp", { recursive: true });
  const attemptedAt = new Date().toISOString();
  const gate = JSON.stringify({ actionKey, attemptedAt });

  try {
    await Deno.writeTextFile(SEND_GATE_PATH, gate, { createNew: true });
    return;
  } catch {
    // An existing gate must be inspected before any provider send call.
  }

  let existing: { attemptedAt?: unknown };
  try {
    existing = JSON.parse(await Deno.readTextFile(SEND_GATE_PATH)) as {
      attemptedAt?: unknown;
    };
  } catch {
    fail("The persistent real email send gate could not be verified. No email was sent.");
  }

  if (typeof existing.attemptedAt !== "string") {
    fail("The persistent real email send gate is invalid. No email was sent.");
  }

  let remainingMs: number;
  try {
    remainingMs = realEmailCooldownRemainingMs(existing.attemptedAt);
  } catch {
    fail("The persistent real email send gate is invalid. No email was sent.");
  }

  if (remainingMs > 0) {
    fail(
      `The 120 second real email cooldown is active for another ${Math.ceil(remainingMs / 1000)} second(s). No email was sent.`,
    );
  }

  try {
    await Deno.remove(SEND_GATE_PATH);
    await Deno.writeTextFile(SEND_GATE_PATH, gate, { createNew: true });
  } catch {
    fail("Another real email test acquired the send gate. No email was sent.");
  }
}

async function syncHostingerSenders(
  client: SupabaseRestClient,
  provider: HostingerMailApiProvider,
) {
  const senders = await provider.listSenders();

  if (senders.length === 0) {
    fail("Hostinger API did not return manageable mailboxes.");
  }

  const now = new Date().toISOString();

  await client.post<SenderProfileRow[]>(
    "/rest/v1/email_sender_profiles?on_conflict=mailbox_resource_id",
    senders.map((sender) => ({
      active: true,
      display_name: sender.displayName,
      last_synced_at: now,
      mailbox_address: sender.mailboxAddress,
      mailbox_resource_id: sender.mailboxResourceId,
      provider: "hostinger_mail_api",
      reply_to_email: sender.replyToEmail ?? null,
    })),
    "resolution=merge-duplicates,return=representation",
  );

  const existing = await client.get<SenderProfileRow[]>(
    "/rest/v1/email_sender_profiles?select=*&provider=eq.hostinger_mail_api&active=eq.true",
  );
  const requested = Deno.env
    .get("EMAIL_E2E_SENDER_EMAIL")
    ?.trim()
    .toLowerCase();
  const requestedSender = requested
    ? existing.find(
      (sender) => sender.mailbox_address.toLowerCase() === requested,
    )
    : null;

  if (requested && !requestedSender) {
    fail("EMAIL_E2E_SENDER_EMAIL is not an active managed mailbox.");
  }

  if (requestedSender) {
    return requestedSender;
  }

  const currentDefault = existing.find((sender) => sender.is_default);

  if (currentDefault) {
    return currentDefault;
  }

  const chosen = chooseSenderForLocalTest(existing, senders);

  if (!chosen) {
    fail("No active/default sender is available for the real email test.");
  }

  await client.patch(
    "/rest/v1/email_sender_profiles?provider=eq.hostinger_mail_api&is_default=eq.true",
    { is_default: false },
    "return=minimal",
  );
  await client.patch(
    `/rest/v1/email_sender_profiles?id=eq.${encodeURIComponent(chosen.id)}`,
    { is_default: true },
    "return=minimal",
  );

  return { ...chosen, is_default: true };
}

function chooseSenderForLocalTest(
  rows: SenderProfileRow[],
  providerSenders: EmailProviderSender[],
) {
  const requested = Deno.env
    .get("EMAIL_E2E_SENDER_EMAIL")
    ?.trim()
    .toLowerCase();
  const knownAddresses = new Set(
    providerSenders.map((sender) => sender.mailboxAddress.toLowerCase()),
  );

  if (requested && knownAddresses.has(requested)) {
    return rows.find(
      (sender) => sender.mailbox_address.toLowerCase() === requested,
    );
  }

  return (
    rows.find((sender) =>
      sender.mailbox_address.toLowerCase().startsWith("adm@"),
    ) ??
    rows[0] ??
    null
  );
}

async function runStep<T>(label: string, step: () => Promise<T>) {
  try {
    return await step();
  } catch (error) {
    if (error instanceof SupabaseHttpError) {
      fail(
        `${label} failed with Supabase status ${error.status}: ${
          error.safeDetails ?? "no details"
        }`,
      );
    }

    throw error;
  }
}

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}
