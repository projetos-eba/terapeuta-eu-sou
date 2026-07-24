import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { handleOptions, jsonResponse } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { getProfileById } from "../_shared/auth/users.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import type { SenderProfileRow } from "../_shared/email/types.ts";

type AuthUserResponse = {
  id: string;
};

const runtime = getRuntime("sync-email-senders");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);
  const apiKey = runtime.env.get("EMAIL_SERVER_API_KEY");
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !serviceRoleKey || !apiKey || !authorization) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
  const authUser = await getCaller(supabaseUrl, serviceRoleKey, authorization);
  const profile = authUser ? await getProfileById(client, authUser.id) : null;

  if (profile?.role !== "admin") {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const provider = new HostingerMailApiProvider({ apiKey });
  const senders = await provider.listSenders();
  const now = new Date().toISOString();

  if (senders.length > 0) {
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
  }

  const existing = await client.get<SenderProfileRow[]>(
    "/rest/v1/email_sender_profiles?select=*&provider=eq.hostinger_mail_api",
  );
  const availableIds = new Set(
    senders.map((sender) => sender.mailboxResourceId),
  );

  await Promise.all(
    existing
      .filter((sender) => !availableIds.has(sender.mailbox_resource_id))
      .map((sender) =>
        client.patch(
          `/rest/v1/email_sender_profiles?id=eq.${encodeURIComponent(
            sender.id,
          )}`,
          {
            active: false,
            last_synced_at: now,
          },
          "return=minimal",
        ),
      ),
  );

  return jsonResponse({
    ok: true,
    syncedCount: senders.length,
  });
});

async function getCaller(
  supabaseUrl: string,
  serviceRoleKey: string,
  authorization: string,
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthUserResponse;
}

export {};
