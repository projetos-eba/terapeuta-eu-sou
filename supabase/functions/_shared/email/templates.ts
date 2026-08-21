import { safeString } from "./validation.ts";
import type { EmailActionKey } from "./types.ts";
import { getEmailActionRegistryEntry } from "./registry.ts";
import { resolveEmailTemplate, sanitizeEmailHtml } from "./management.ts";

type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderEmailTemplate(
  actionKey: EmailActionKey,
  data: Record<string, unknown>,
  overrides?: {
    subject_override?: string | null;
    preheader_override?: string | null;
    text_override?: string | null;
    html_override?: string | null;
  },
  templateVersion?: string,
): RenderedTemplate {
  const entry = getEmailActionRegistryEntry(actionKey);
  if (!entry) throw new Error("unsupported_email_action");
  const template = resolveEmailTemplate(
    actionKey,
    overrides ?? {},
    templateVersion,
  );
  const values = resolveTemplateValues(entry, data);
  const replace = (value: string, html: boolean) =>
    value.replace(/{{\s*([a-z_]+)\s*}}/g, (_, token: string) => {
      const tokenDefinition = entry.allowedTokens.find(
        (definition) => definition.key === token,
      );
      if (!tokenDefinition) throw new Error("email_template_token_not_allowed");
      const resolved = values[token];
      if (resolved === undefined)
        throw new Error("email_template_token_missing");
      return html ? escapeHtml(resolved) : resolved;
    });
  const preheader = replace(template.preheader, false);
  return {
    subject: replace(template.subject, false),
    text: replace(template.text, false),
    html: injectPreheader(
      sanitizeEmailHtml(replace(template.html, true)),
      preheader,
    ),
  };
}

function resolveTemplateValues(
  entry: NonNullable<ReturnType<typeof getEmailActionRegistryEntry>>,
  data: Record<string, unknown>,
) {
  const aliases: Record<string, unknown> = {
    recipient_name: data.recipient_name ?? data.name,
    verification_url: data.verification_url ?? data.url,
    reset_url: data.reset_url ?? data.url,
    request_name: data.request_name ?? data.requestName,
    request_url: data.request_url ?? data.url,
    request_status: data.request_status ?? data.status,
    decision_message: data.decision_message ?? data.decision,
  };
  const values: Record<string, string> = {};
  for (const token of entry.allowedTokens) {
    const source = data[token.key] ?? aliases[token.key];
    if (source === undefined || source === null) {
      continue;
    }
    values[token.key] =
      token.kind === "url" ? safeUrl(source) : safeText(source, 800);
  }
  return values;
}

function safeUrl(value: unknown) {
  const url = safeString(value).trim();

  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    throw new Error("invalid_template_url");
  }

  return url;
}

function safeText(value: unknown, maxLength: number) {
  return safeString(value)
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function injectPreheader(html: string, preheader: string) {
  const hidden = `<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>`;
  const withPreheader = html.replace(
    /<body[^>]*>/i,
    (body) => `${body}${hidden}`,
  );
  return withPreheader === html ? `${hidden}${html}` : withPreheader;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
