import { sanitizeHeaderText, safeString } from "./validation.ts";
import type { EmailActionKey, UserRole } from "./types.ts";

type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderEmailTemplate(
  actionKey: EmailActionKey,
  data: Record<string, unknown>,
): RenderedTemplate {
  if (actionKey === "email_verification") {
    return renderEmailVerification(data);
  }

  if (actionKey === "password_reset") {
    return renderPasswordReset(data);
  }

  throw new Error("unsupported_email_action");
}

function renderEmailVerification(data: Record<string, unknown>) {
  const name = safeDisplayName(data.name);
  const verificationUrl = safeUrl(data.url);
  const role = safeRole(data.role);
  const loginHint =
    role === "therapist"
      ? "Depois da confirmacao, voce podera entrar na sua area profissional."
      : "Depois da confirmacao, voce podera continuar sua jornada no TES.";
  const subject = "Confirme seu e-mail no Terapeuta Eu Sou";

  return {
    subject,
    html: baseHtml({
      body: [
        `Ola${name ? `, ${escapeHtml(name)}` : ""}.`,
        "Recebemos seu cadastro no Terapeuta Eu Sou.",
        "Para proteger sua conta, confirme seu e-mail pelo botao abaixo.",
        loginHint,
      ],
      buttonLabel: "Confirmar e-mail",
      buttonUrl: verificationUrl,
      title: "Confirme seu e-mail",
    }),
    text: [
      `Ola${name ? `, ${name}` : ""}.`,
      "Recebemos seu cadastro no Terapeuta Eu Sou.",
      "Confirme seu e-mail pelo link:",
      verificationUrl,
      loginHint,
    ].join("\n\n"),
  };
}

function renderPasswordReset(data: Record<string, unknown>) {
  const name = safeDisplayName(data.name);
  const resetUrl = safeUrl(data.url);
  const subject = "Recupere sua senha no Terapeuta Eu Sou";

  return {
    subject,
    html: baseHtml({
      body: [
        `Ola${name ? `, ${escapeHtml(name)}` : ""}.`,
        "Recebemos uma solicitacao para redefinir sua senha.",
        "Se foi voce, use o botao abaixo. O link expira em 1 hora.",
        "Se voce nao fez essa solicitacao, pode ignorar esta mensagem.",
      ],
      buttonLabel: "Redefinir senha",
      buttonUrl: resetUrl,
      title: "Redefina sua senha",
    }),
    text: [
      `Ola${name ? `, ${name}` : ""}.`,
      "Recebemos uma solicitacao para redefinir sua senha.",
      "Use o link abaixo. Ele expira em 1 hora.",
      resetUrl,
      "Se voce nao fez essa solicitacao, pode ignorar esta mensagem.",
    ].join("\n\n"),
  };
}

function baseHtml({
  body,
  buttonLabel,
  buttonUrl,
  title,
}: {
  body: string[];
  buttonLabel: string;
  buttonUrl: string;
  title: string;
}) {
  const paragraphs = body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#3f3a68;font-family:Arial,sans-serif;font-size:16px;line-height:1.6">${paragraph}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#F8F4FF;padding:32px">
    <main style="margin:0 auto;max-width:560px;border-radius:24px;background:#ffffff;padding:32px;border:1px solid #E7DAF2">
      <h1 style="margin:0 0 20px;color:#14105A;font-family:Georgia,serif;font-size:32px;font-weight:400">${escapeHtml(title)}</h1>
      ${paragraphs}
      <p style="margin:24px 0">
        <a href="${escapeAttribute(buttonUrl)}" style="display:inline-block;border-radius:999px;background:#6C3D91;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 22px;text-decoration:none">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="margin:24px 0 0;color:#6f6a8f;font-family:Arial,sans-serif;font-size:13px;line-height:1.6">Este e-mail foi enviado porque houve uma acao de conta no Terapeuta Eu Sou.</p>
    </main>
  </body>
</html>`;
}

function safeDisplayName(value: unknown) {
  const trimmed = safeString(value).trim();
  return sanitizeHeaderText(trimmed).slice(0, 120);
}

function safeRole(value: unknown): UserRole | null {
  return value === "patient" || value === "therapist" || value === "admin"
    ? value
    : null;
}

function safeUrl(value: unknown) {
  const url = safeString(value).trim();

  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    throw new Error("invalid_template_url");
  }

  return url;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
