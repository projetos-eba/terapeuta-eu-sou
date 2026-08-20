import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey, getSiteUrl } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { getProfileById } from "../_shared/auth/users.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";

const runtime = getRuntime("email-outbox-dispatch");
runtime.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const url = runtime.env.get("SUPABASE_URL"); const key = getServiceRoleKey(runtime);
  if (!url || !key || request.headers.get("authorization") !== `Bearer ${key}`) return response({ error: "unauthorized" }, 401);
  const client = new SupabaseRestClient(url, key); const workerId = crypto.randomUUID();
  const rows = await client.rpc<OutboxRow[]>("claim_email_outbox_v1", { p_worker_id: workerId, p_limit: 10 });
  const results = [] as Array<{ id: string; status: string }>;
  for (const row of rows) { results.push(await dispatchOne(client, key, workerId, row)); }
  return response({ ok: true, processed: results.length, results });
});

async function dispatchOne(client: SupabaseRestClient, apiKey: string, workerId: string, row: OutboxRow) {
  try {
    const request = await loadRequest(client, row.related_entity_id); const recipient = await getProfileById(client, row.recipient_user_id);
    if (!recipient?.email) return finish(client, row.id, workerId, "skipped", "recipient_unavailable");
    const result = await sendTransactionalEmail(client, new HostingerMailApiProvider({ apiKey }), {
      actionKey: row.action_key, dispatchMode: "automatic", recipient: { email: recipient.email, name: recipient.display_name }, recipientRole: "therapist", recipientUserId: recipient.id,
      relatedEntityId: row.related_entity_id, relatedEntityType: "therapy_catalog_request", templateData: {
        name: recipient.display_name, requestName: request.informed_name, status: request.status, decision: request.decision,
        url: `${getSiteUrl(runtime)}/terapeuta/mensagens/solicitar-terapia?request=${encodeURIComponent(row.related_entity_id)}`,
      },
    });
    return finish(client, row.id, workerId, result.status === "success" ? "delivered" : result.status === "skipped" ? "skipped" : "retry_pending", result.status === "error" ? "provider_delivery_failed" : null);
  } catch { return finish(client, row.id, workerId, "retry_pending", "dispatcher_failed"); }
}
async function finish(client: SupabaseRestClient, outboxId: string, workerId: string, outcome: "delivered" | "skipped" | "retry_pending", error: string | null) {
  const row = await client.rpc<{ status: string }>("complete_email_outbox_v1", { p_outbox_id: outboxId, p_worker_id: workerId, p_outcome: outcome, p_last_error: error });
  return { id: outboxId, status: row.status };
}
async function loadRequest(client: SupabaseRestClient, id: string) { const rows = await client.get<Array<{ informed_name: string; status: string; decision: string | null }>>(`/rest/v1/therapy_catalog_requests?select=informed_name,status,decision&id=eq.${encodeURIComponent(id)}&limit=1`); if (!rows[0]) throw new Error("request_not_found"); return rows[0]; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
type OutboxRow = { id: string; action_key: "therapy_catalog_request_submitted" | "therapy_catalog_request_updated"; related_entity_id: string; recipient_user_id: string };
