import { handleOptions } from "../_shared/auth/cors.ts";
import {
  getRuntime,
  getServiceRoleKey,
  getSiteUrl,
} from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { getProfileById } from "../_shared/auth/users.ts";
import { EmailProviderError } from "../_shared/email/errors.ts";
import { HostingerMailApiProvider } from "../_shared/email/hostinger-mail-api-provider.ts";
import { getEmailActionRegistryEntry } from "../_shared/email/registry.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { isHmlProject, safeEqual, toDispatchLimit } from "./security.ts";

const runtime = getRuntime("email-outbox-dispatch");

runtime.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST")
    return response({ error: "method_not_allowed" }, 405);

  const url = runtime.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = getServiceRoleKey(runtime);
  if (!url || !serviceRoleKey) return response({ error: "unavailable" }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const client = new SupabaseRestClient(url, serviceRoleKey);

  if (body.action === "arm_test_failure")
    return armTestFailure(request, client, url, body);

  const dispatchSecret = runtime.env.get("EMAIL_OUTBOX_DISPATCH_SECRET");
  if (
    !dispatchSecret ||
    !safeEqual(
      request.headers.get("x-email-outbox-dispatch-secret"),
      dispatchSecret,
    )
  )
    return response({ error: "unauthorized" }, 401);
  const mailApiKey = runtime.env.get("EMAIL_SERVER_API_KEY")?.trim();
  if (!mailApiKey) return response({ error: "unavailable" }, 503);

  const workerId = crypto.randomUUID();
  const rows = await client.rpc<OutboxRow[]>("claim_email_outbox_v1", {
    p_worker_id: workerId,
    p_limit: toDispatchLimit(body.limit),
  });
  const outcomes: Record<string, number> = {};
  for (const row of rows) {
    const status = await dispatchOne(client, mailApiKey, workerId, row);
    outcomes[status] = (outcomes[status] ?? 0) + 1;
  }
  return response({ ok: true, processed: rows.length, outcomes });
});

async function armTestFailure(
  request: Request,
  client: SupabaseRestClient,
  supabaseUrl: string,
  body: Record<string, unknown>,
) {
  const testSecret = runtime.env.get("EMAIL_OUTBOX_TEST_FAILURE_SECRET");
  if (
    !isHmlProject(supabaseUrl) ||
    !testSecret ||
    !safeEqual(request.headers.get("x-email-outbox-test-secret"), testSecret)
  )
    return response({ error: "not_found" }, 404);
  const actionKey = typeof body.actionKey === "string" ? body.actionKey : "";
  const recipientKey =
    typeof body.recipientKey === "string" ? body.recipientKey : "";
  if (
    !getEmailActionRegistryEntry(actionKey) ||
    !/^profile:[0-9a-f-]{36}$/i.test(recipientKey)
  )
    return response({ error: "invalid_request" }, 422);
  await client.rpc("arm_email_outbox_test_fault_v1", {
    p_action_key: actionKey,
    p_recipient_key: recipientKey,
    p_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  return response({ ok: true }, 201);
}

async function dispatchOne(
  client: SupabaseRestClient,
  mailApiKey: string,
  workerId: string,
  row: OutboxRow,
) {
  try {
    if (
      await client.rpc<boolean>("consume_email_outbox_test_fault_v1", {
        p_action_key: row.action_key,
        p_recipient_key: row.recipient_key,
      })
    ) {
      throw new EmailProviderError(
        "test_provider_failure",
        "Email provider returned an error.",
        503,
        true,
        1,
        "not_accepted",
      );
    }
    const request = await loadRequest(client, row.related_entity_id);
    const recipient = await getProfileById(client, row.recipient_user_id);
    if (!recipient?.email)
      return finish(
        client,
        row.id,
        workerId,
        "skipped",
        "recipient_unavailable",
      );
    const result = await sendTransactionalEmail(
      client,
      new HostingerMailApiProvider({ apiKey: mailApiKey }),
      {
        actionKey: row.action_key,
        correlationId: row.id,
        dispatchMode: "automatic",
        recipient: { email: recipient.email, name: recipient.display_name },
        recipientRole: "therapist",
        recipientUserId: recipient.id,
        relatedEntityId: row.related_entity_id,
        relatedEntityType: "therapy_catalog_request",
        templateData: {
          name: recipient.display_name,
          requestName: request.informed_name,
          status: request.status,
          decision: request.decision,
          url: `${getSiteUrl(runtime)}/terapeuta/mensagens/solicitar-terapia?request=${encodeURIComponent(row.related_entity_id)}`,
        },
        deliverySnapshot: {
          senderProfileId: row.sender_profile_id,
          templateOverrides: row.template_overrides,
          templateVersion: row.template_version,
        },
      },
    );
    if (result.status === "success")
      return finish(client, row.id, workerId, "delivered", null);
    if (result.status === "skipped")
      return finish(client, row.id, workerId, "skipped", "dispatch_skipped");
    return result.deliveryOutcome === "not_accepted"
      ? finish(
          client,
          row.id,
          workerId,
          "retry_pending",
          "provider_not_accepted",
        )
      : finish(
          client,
          row.id,
          workerId,
          "dead",
          "delivery_outcome_unknown",
          true,
          "delivery_outcome_unknown",
        );
  } catch (error) {
    if (
      error instanceof EmailProviderError &&
      error.deliveryOutcome === "not_accepted"
    )
      return finish(
        client,
        row.id,
        workerId,
        "retry_pending",
        "provider_not_accepted",
      );
    return finish(
      client,
      row.id,
      workerId,
      "dead",
      "delivery_outcome_unknown",
      true,
      "delivery_outcome_unknown",
    );
  }
}

async function finish(
  client: SupabaseRestClient,
  outboxId: string,
  workerId: string,
  outcome: "delivered" | "skipped" | "retry_pending" | "dead",
  error: string | null,
  reviewRequired = false,
  reviewReason: string | null = null,
) {
  const row = await client.rpc<{ status: string }>("complete_email_outbox_v1", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
    p_outcome: outcome,
    p_last_error: error,
    p_review_required: reviewRequired,
    p_review_reason: reviewReason,
  });
  return row.status;
}

async function loadRequest(client: SupabaseRestClient, id: string) {
  const rows = await client.get<
    Array<{ informed_name: string; status: string; decision: string | null }>
  >(
    `/rest/v1/therapy_catalog_requests?select=informed_name,status,decision&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!rows[0]) throw new Error("request_not_found");
  return rows[0];
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type OutboxRow = {
  id: string;
  action_key:
    | "therapy_catalog_request_submitted"
    | "therapy_catalog_request_updated";
  related_entity_id: string;
  recipient_user_id: string;
  recipient_key: string;
  sender_profile_id: string | null;
  template_overrides: Record<string, string | null>;
  template_version: string;
};
