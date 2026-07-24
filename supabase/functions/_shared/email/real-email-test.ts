import { getServiceRoleKey, type EdgeRuntime } from "../auth/runtime.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../auth/supabase-rest.ts";
import { HostingerMailApiProvider } from "./hostinger-mail-api-provider.ts";
import { sendTransactionalEmail } from "./service.ts";
import type { EmailProviderSender, SenderProfileRow } from "./types.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  exit(code?: number): never;
};

const ALLOWED_RECIPIENT = "viniciusferrari.silva@gmail.com";

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

if (recipient !== ALLOWED_RECIPIENT) {
  fail("EMAIL_E2E_RECIPIENT is not the approved recipient.");
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Supabase admin environment is not configured.");
}

if (!apiKey) {
  fail("EMAIL_SERVER_API_KEY is not configured.");
}

const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
const provider = new HostingerMailApiProvider({ apiKey });
const syncedSender = await runStep("sync_hostinger_senders", () =>
  syncHostingerSenders(client, provider),
);
const result = await runStep("send_real_email", () =>
  sendTransactionalEmail(client, provider, {
    actionKey: "email_verification",
    correlationId: `email-e2e-${crypto.randomUUID()}`,
    recipient: {
      email: recipient,
      name: "Teste TES",
    },
    recipientRole: "admin",
    templateData: {
      name: "Teste TES",
      role: "admin",
      url: "http://localhost:3000/confirmar-email?token=test-only",
    },
  }),
);

if (result.status !== "success") {
  fail("Real email test did not complete successfully.");
}

console.log(
  `Real email test sent to the approved recipient from ${syncedSender.mailbox_address}.`,
);

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
