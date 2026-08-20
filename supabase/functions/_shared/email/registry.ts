import type { EmailActionKey } from "./types.ts";

export type EmailTokenDefinition = {
  key: string;
  label: string;
  kind?: "text" | "url";
};
export type EmailActionRegistryEntry = {
  actionKey: EmailActionKey;
  category: string;
  label: string;
  description: string;
  supportsAutomaticDispatch: boolean;
  adminConfigurable: boolean;
  currentTemplateVersion: string;
  defaults: { subject: string; preheader: string; text: string; html: string };
  allowedTokens: readonly EmailTokenDefinition[];
  previewFixture: Record<string, string>;
};

const requestTokens = [
  { key: "recipient_name", label: "Nome da pessoa" },
  { key: "request_name", label: "Nome da solicitação" },
  { key: "request_url", label: "Link da solicitação", kind: "url" },
] as const;

export const emailActionRegistry: Record<
  EmailActionKey,
  EmailActionRegistryEntry
> = {
  email_verification: {
    actionKey: "email_verification",
    category: "Acesso e segurança",
    label: "Confirmação de e-mail",
    description: "Confirma o endereço de uma nova conta.",
    supportsAutomaticDispatch: true,
    adminConfigurable: false,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Confirme seu e-mail no Terapeuta Eu Sou",
      preheader: "Confirme seu e-mail para concluir seu cadastro.",
      text: "Olá, {{recipient_name}}. Confirme seu e-mail: {{verification_url}}",
      html: '<p>Olá, {{recipient_name}}.</p><p>Confirme seu e-mail: <a href="{{verification_url}}">Confirmar e-mail</a></p>',
    },
    allowedTokens: [
      { key: "recipient_name", label: "Nome da pessoa" },
      { key: "verification_url", label: "Link de confirmação", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      verification_url: "https://example.test/confirmar",
    },
  },
  password_reset: {
    actionKey: "password_reset",
    category: "Acesso e segurança",
    label: "Redefinição de senha",
    description: "Envia um link temporário de recuperação.",
    supportsAutomaticDispatch: true,
    adminConfigurable: false,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Recupere sua senha no Terapeuta Eu Sou",
      preheader: "Use o link seguro para redefinir sua senha.",
      text: "Olá, {{recipient_name}}. Redefina sua senha: {{reset_url}}",
      html: '<p>Olá, {{recipient_name}}.</p><p><a href="{{reset_url}}">Redefinir senha</a></p>',
    },
    allowedTokens: [
      { key: "recipient_name", label: "Nome da pessoa" },
      { key: "reset_url", label: "Link de redefinição", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      reset_url: "https://example.test/redefinir",
    },
  },
  therapy_catalog_request_submitted: {
    actionKey: "therapy_catalog_request_submitted",
    category: "Catálogo de terapias",
    label: "Solicitação de terapia recebida",
    description: "Confirma a recepção de uma sugestão de terapia.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Recebemos sua sugestão de terapia — Terapeuta Eu Sou",
      preheader: "Sua solicitação foi recebida pela nossa equipe.",
      text: "Olá, {{recipient_name}}. Recebemos sua sugestão {{request_name}}. Acompanhe: {{request_url}}",
      html: '<p>Olá, {{recipient_name}}.</p><p>Recebemos sua sugestão <strong>{{request_name}}</strong>.</p><p><a href="{{request_url}}">Acompanhar solicitação</a></p>',
    },
    allowedTokens: requestTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      request_name: "Terapia de exemplo",
      request_url: "https://example.test/solicitacao",
    },
  },
  therapy_catalog_request_updated: {
    actionKey: "therapy_catalog_request_updated",
    category: "Catálogo de terapias",
    label: "Solicitação de terapia atualizada",
    description: "Comunica uma atualização na sugestão enviada.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Atualização da sua sugestão de terapia — Terapeuta Eu Sou",
      preheader: "Há uma atualização na sua solicitação.",
      text: "Olá, {{recipient_name}}. Sua solicitação {{request_name}} foi atualizada para {{request_status}}. {{decision_message}} {{request_url}}",
      html: '<p>Olá, {{recipient_name}}.</p><p>Sua solicitação <strong>{{request_name}}</strong> foi atualizada para {{request_status}}.</p><p>{{decision_message}}</p><p><a href="{{request_url}}">Ver atualização</a></p>',
    },
    allowedTokens: [
      ...requestTokens,
      { key: "request_status", label: "Status da solicitação" },
      { key: "decision_message", label: "Mensagem da equipe" },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      request_name: "Terapia de exemplo",
      request_status: "em análise",
      decision_message: "Nossa equipe registrou sua solicitação.",
      request_url: "https://example.test/solicitacao",
    },
  },
};

export function getEmailActionRegistryEntry(actionKey: string) {
  return emailActionRegistry[actionKey as EmailActionKey] ?? null;
}
export function getAdminConfigurableEmailActions() {
  return Object.values(emailActionRegistry).filter(
    (entry) => entry.adminConfigurable,
  );
}
