import sanitizeHtml from "npm:sanitize-html@2.17.7";
import { getEmailActionRegistryEntry } from "./registry.ts";

const options: sanitizeHtml.IOptions = {
  allowedTags: ["a", "b", "br", "div", "em", "h1", "h2", "h3", "li", "ol", "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
  allowedAttributes: { "*": ["style"], a: ["href", "title", "target", "rel"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
  allowedSchemes: ["https"],
  allowedSchemesByTag: { a: ["http", "https"] },
  allowedStyles: { "*": { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i], "background-color": [/^#[0-9a-f]{3,8}$/i], "font-size": [/^\d+(px|em|rem|%)$/], "font-family": [/^[\w ,'-]+$/], "font-weight": [/^(normal|bold|[1-9]00)$/], "line-height": [/^[\d.]+(px|em|rem|%)?$/], margin: [/^[\d\s.-]+(px|em|rem|%)?$/], padding: [/^[\d\s.-]+(px|em|rem|%)?$/], "text-align": [/^(left|center|right)$/] } },
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
};

export function sanitizeEmailHtml(value: string) { return sanitizeHtml(value, options); }

export function resolveEmailTemplate(actionKey: string, overrides: Partial<{ subject_override: string | null; preheader_override: string | null; text_override: string | null; html_override: string | null }>) {
  const entry = getEmailActionRegistryEntry(actionKey);
  if (!entry) throw new Error("unknown_email_action");
  return {
    subject: overrides.subject_override ?? entry.defaults.subject,
    preheader: overrides.preheader_override ?? entry.defaults.preheader,
    text: overrides.text_override ?? entry.defaults.text,
    html: sanitizeEmailHtml(overrides.html_override ?? entry.defaults.html),
  };
}

export function renderEmailManagementPreview(actionKey: string, overrides: Partial<{ subject_override: string | null; preheader_override: string | null; text_override: string | null; html_override: string | null }>) {
  const entry = getEmailActionRegistryEntry(actionKey);
  if (!entry) throw new Error("unknown_email_action");
  const template = resolveEmailTemplate(actionKey, overrides);
  const allowed = new Set(entry.allowedTokens.map((token) => token.key));
  const render = (input: string, html = false) => input.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => {
    if (!allowed.has(key)) throw new Error("email_template_token_not_allowed");
    const value = entry.previewFixture[key] ?? "";
    return html ? escapeHtml(value) : value;
  });
  return { subject: render(template.subject), preheader: render(template.preheader), text: render(template.text), html: sanitizeEmailHtml(render(template.html, true)) };
}

function escapeHtml(value: string) { return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
