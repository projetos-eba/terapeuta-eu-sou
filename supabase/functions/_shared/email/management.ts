import sanitizeHtml from "npm:sanitize-html@2.17.7";
import { getEmailActionRegistryEntry } from "./registry.ts";

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "body",
    "br",
    "div",
    "em",
    "head",
    "h1",
    "h2",
    "h3",
    "html",
    "img",
    "li",
    "meta",
    "ol",
    "p",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "title", "target", "rel"],
    body: ["style"],
    html: ["lang", "dir"],
    img: ["alt", "height", "src", "width"],
    meta: ["charset", "content", "http-equiv", "name"],
    table: ["align", "border", "cellpadding", "cellspacing", "role", "width"],
    td: ["align", "bgcolor", "colspan", "rowspan", "valign", "width"],
    th: ["align", "bgcolor", "colspan", "rowspan", "valign", "width"],
  },
  allowedSchemes: ["https"],
  allowedSchemesByTag: { a: ["http", "https"] },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i],
      border: [/^(0|none|\d+px\s+solid\s+#[0-9a-f]{3,8})$/i],
      "border-collapse": [/^(collapse|separate)$/],
      "border-radius": [/^\d+(px|em|rem|%)$/],
      "border-top": [/^(0|none|\d+px\s+solid\s+#[0-9a-f]{3,8})$/i],
      display: [/^(block|inline|inline-block|none)$/],
      "font-size": [/^\d+(px|em|rem|%)$/],
      "font-family": [/^[\w ,'-]+$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      height: [/^(auto|\d+(px|em|rem|%))$/],
      "letter-spacing": [/^-?\d+(px|em|rem)$/],
      "line-height": [/^[\d.]+(px|em|rem|%)?$/],
      margin: [/^\d+(px|em|rem|%)(\s+\d+(px|em|rem|%)){0,3}$/],
      "max-height": [/^\d+(px|em|rem|%)$/],
      "max-width": [/^\d+(px|em|rem|%)$/],
      opacity: [/^(0|0?\.\d+|1)$/],
      overflow: [/^(hidden|visible)$/],
      padding: [/^\d+(px|em|rem|%)(\s+\d+(px|em|rem|%)){0,3}$/],
      "text-align": [/^(left|center|right)$/],
      "text-decoration": [/^(none|underline)$/],
      width: [/^\d+(px|em|rem|%)$/],
    },
  },
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
  nonTextTags: ["script", "style", "textarea", "option", "title"],
};

export function sanitizeEmailHtml(value: string) {
  return sanitizeHtml(value, options);
}

export function resolveEmailTemplate(
  actionKey: string,
  overrides: Partial<{
    subject_override: string | null;
    preheader_override: string | null;
    text_override: string | null;
    html_override: string | null;
  }>,
  templateVersion?: string,
) {
  const entry = getEmailActionRegistryEntry(actionKey);
  if (!entry) throw new Error("unknown_email_action");
  if (templateVersion && templateVersion !== entry.currentTemplateVersion)
    throw new Error("unknown_email_template_version");
  return {
    subject: overrides.subject_override ?? entry.defaults.subject,
    preheader: overrides.preheader_override ?? entry.defaults.preheader,
    text: overrides.text_override ?? entry.defaults.text,
    html: sanitizeEmailHtml(overrides.html_override ?? entry.defaults.html),
  };
}

export function renderEmailManagementPreview(
  actionKey: string,
  overrides: Partial<{
    subject_override: string | null;
    preheader_override: string | null;
    text_override: string | null;
    html_override: string | null;
  }>,
) {
  const entry = getEmailActionRegistryEntry(actionKey);
  if (!entry) throw new Error("unknown_email_action");
  const template = resolveEmailTemplate(actionKey, overrides);
  const allowed = new Set(entry.allowedTokens.map((token) => token.key));
  const render = (input: string, html = false) =>
    input.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => {
      if (!allowed.has(key))
        throw new Error("email_template_token_not_allowed");
      const value = entry.previewFixture[key] ?? "";
      return html ? escapeHtml(value) : value;
    });
  return {
    subject: render(template.subject),
    preheader: render(template.preheader),
    text: render(template.text),
    html: sanitizeEmailHtml(render(template.html, true)),
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'\"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}
