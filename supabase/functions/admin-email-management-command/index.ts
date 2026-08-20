import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  getAdminConfigurableEmailActions,
  getEmailActionRegistryEntry,
} from "../_shared/email/registry.ts";
import {
  renderEmailManagementPreview,
  sanitizeEmailHtml,
} from "../_shared/email/management.ts";

const runtime = getRuntime("admin-email-management-command");
runtime.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST")
      throw new DomainError("method_not_allowed", 405, "Método não permitido.");
    const url = runtime.env.get("SUPABASE_URL");
    const key = getServiceRoleKey(runtime);
    if (!url || !key)
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuração indisponível.",
      );
    const client = new SupabaseRestClient(url, key);
    const actor = await requireUser(client, request);
    if (actor.role !== "admin")
      throw new DomainError(
        "forbidden",
        403,
        "Acesso administrativo necessário.",
      );
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (body.action === "list") return success(await list(client));
    const actionKey = typeof body.actionKey === "string" ? body.actionKey : "";
    const entry = getEmailActionRegistryEntry(actionKey);
    if (!entry?.adminConfigurable)
      throw new DomainError(
        "unknown_email_action",
        422,
        "Evento não disponível para configuração.",
      );
    if (body.action === "get") return success(await detail(client, actionKey));
    if (body.action === "preview")
      return success({
        preview: renderEmailManagementPreview(
          actionKey,
          cleanOverrides(body.overrides),
        ),
      });
    if (body.action === "save")
      return success(await save(client, actor.id, actionKey, body));
    throw new DomainError("invalid_payload", 422, "Revise os dados enviados.");
  } catch (error) {
    return failure(error, requestId);
  }
});

type Sender = {
  id: string;
  display_name: string;
  mailbox_address: string;
  active: boolean;
  is_default: boolean;
};
type Setting = {
  action_key: string;
  sender_profile_id: string | null;
  enabled: boolean;
  automatic_dispatch_enabled: boolean;
  subject_override: string | null;
  preheader_override: string | null;
  text_override: string | null;
  html_override: string | null;
};
async function list(client: SupabaseRestClient) {
  const [senders, settings, logs] = await Promise.all([
    client.get<Sender[]>(
      "/rest/v1/email_sender_profiles?select=id,display_name,mailbox_address,active,is_default&order=is_default.desc,display_name.asc",
    ),
    client.get<Setting[]>(
      "/rest/v1/email_action_settings?select=action_key,sender_profile_id,enabled,automatic_dispatch_enabled,subject_override,preheader_override,text_override,html_override",
    ),
    client.get<
      Array<{
        action_key: string;
        recipient_email: string;
        status: string;
        attempt_count: number;
        error_message: string | null;
        created_at: string;
      }>
    >(
      "/rest/v1/email_delivery_logs?select=action_key,recipient_email,status,attempt_count,error_message,created_at&order=created_at.desc&limit=25",
    ),
  ]);
  return {
    actions: getAdminConfigurableEmailActions().map((entry) => ({
      ...entry,
      setting:
        settings.find((setting) => setting.action_key === entry.actionKey) ??
        null,
    })),
    senders,
    logs: logs.map((log) => ({
      ...log,
      recipient_email: maskEmail(log.recipient_email),
      error_message: log.error_message?.slice(0, 180) ?? null,
    })),
  };
}
async function detail(client: SupabaseRestClient, actionKey: string) {
  const result = await list(client);
  const action = result.actions.find((item) => item.actionKey === actionKey);
  if (!action)
    throw new DomainError("not_found", 404, "Evento não encontrado.");
  return {
    ...action,
    senders: result.senders,
    preview: renderEmailManagementPreview(actionKey, action.setting ?? {}),
  };
}
async function save(
  client: SupabaseRestClient,
  actorId: string,
  actionKey: string,
  body: Record<string, unknown>,
) {
  const overrides = cleanOverrides(body.overrides);
  const enabled = body.enabled !== false;
  const automatic = body.automaticDispatchEnabled !== false;
  const senderProfileId =
    typeof body.senderProfileId === "string" ? body.senderProfileId : null;
  if (senderProfileId) {
    const rows = await client.get<Sender[]>(
      `/rest/v1/email_sender_profiles?select=id,active&id=eq.${encodeURIComponent(senderProfileId)}&limit=1`,
    );
    if (!rows[0]?.active)
      throw new DomainError(
        "invalid_sender_profile",
        422,
        "Selecione um perfil de envio ativo.",
      );
  }
  const row = {
    action_key: actionKey,
    sender_profile_id: senderProfileId,
    enabled,
    automatic_dispatch_enabled: automatic,
    ...overrides,
  };
  await client.post(
    "/rest/v1/email_action_settings?on_conflict=action_key",
    row,
    "resolution=merge-duplicates,return=minimal",
  );
  await client
    .post(
      "/rest/v1/admin_audit_events",
      {
        actor_user_id: actorId,
        action: "email_management_saved",
        entity_type: "email_action_setting",
        entity_id: actionKey,
        metadata: {
          automatic,
          enabled,
          has_custom_template: Boolean(
            overrides.html_override ||
            overrides.text_override ||
            overrides.subject_override ||
            overrides.preheader_override,
          ),
          sender_profile_id: senderProfileId,
        },
      },
      "return=minimal",
    )
    .catch(() => undefined);
  return detail(client, actionKey);
}
function cleanOverrides(value: unknown) {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const text = (key: string, max: number) =>
    typeof raw[key] === "string" && raw[key].trim()
      ? raw[key].trim().slice(0, max)
      : null;
  return {
    subject_override: text("subject", 240),
    preheader_override: text("preheader", 500),
    text_override: text("text", 30000),
    html_override:
      typeof raw.html === "string" && raw.html.trim()
        ? sanitizeEmailHtml(raw.html).slice(0, 60000)
        : null,
  };
}
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${(name ?? "").slice(0, 2)}***@${domain ?? "***"}`;
}
