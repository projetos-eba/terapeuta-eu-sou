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

const accountTokens = [
  { key: "recipient_name", label: "Nome da pessoa" },
] as const;

const bookingTokens = [
  { key: "recipient_name", label: "Nome da pessoa" },
  { key: "counterparty_name", label: "Nome da outra pessoa" },
  { key: "service_title", label: "Nome da terapia" },
  { key: "meeting_date_time", label: "Data e horário" },
  { key: "meeting_timezone", label: "Fuso horário" },
  { key: "encounter_url", label: "Link do encontro", kind: "url" },
] as const;

const paymentTokens = [
  { key: "recipient_name", label: "Nome da pessoa" },
  { key: "amount", label: "Valor" },
  { key: "service_title", label: "Nome da terapia" },
  { key: "payment_url", label: "Link de pagamentos", kind: "url" },
] as const;

const refundTokens = [
  { key: "recipient_name", label: "Nome da pessoa" },
  { key: "amount", label: "Valor do reembolso" },
  { key: "refund_url", label: "Link de pagamentos", kind: "url" },
] as const;

const payoutTokens = [
  { key: "recipient_name", label: "Nome do terapeuta" },
  { key: "amount", label: "Valor do repasse" },
  { key: "finance_url", label: "Link do painel financeiro", kind: "url" },
] as const;

const subscriptionTokens = [
  { key: "recipient_name", label: "Nome do terapeuta" },
  { key: "plan_name", label: "Nome do plano" },
  { key: "date", label: "Data" },
  { key: "next_renewal_date", label: "Próxima renovação" },
  { key: "subscription_url", label: "Link da assinatura", kind: "url" },
] as const;

const subscriptionCancellationTokens = [
  { key: "recipient_name", label: "Nome do terapeuta" },
  { key: "plan_name", label: "Nome do plano anterior" },
  { key: "date", label: "Data do cancelamento" },
  { key: "account_status", label: "Status atual da conta" },
  { key: "subscription_url", label: "Link da assinatura", kind: "url" },
] as const;

const subscriptionPlanChangeTokens = [
  { key: "recipient_name", label: "Nome do terapeuta" },
  { key: "new_plan_name", label: "Nome do novo plano" },
  { key: "date", label: "Data da alteração" },
  { key: "next_renewal_date", label: "Próxima renovação" },
  { key: "subscription_url", label: "Link da assinatura", kind: "url" },
] as const;

function defaultEmailHtml(input: {
  body: string;
  ctaLabel: string;
  ctaUrlToken: string;
  title: string;
}) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${input.title}</title>
  </head>
  <body style="margin:0;background:#f8f4ff;padding:32px">
    <main style="margin:0 auto;max-width:560px;border:1px solid #e7daf2;border-radius:24px;background:#ffffff;padding:32px">
      <h1 style="margin:0 0 20px;color:#14105a;font-family:Georgia,serif;font-size:32px;font-weight:400">${input.title}</h1>
      ${input.body}
      <p style="margin:24px 0"><a href="{{${input.ctaUrlToken}}}" style="display:inline-block;border-radius:999px;background:#6c3d91;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 22px;text-decoration:none">${input.ctaLabel}</a></p>
      <p style="margin:24px 0 0;color:#6f6a8f;font-family:Arial,sans-serif;font-size:13px;line-height:1.6">Equipe TES</p>
      <p style="margin:16px 0 0;color:#6f6a8f;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">Terapeuta Eu Sou · <a href="https://terapeutaeusou.com.br/termos">Termos de Uso</a> · <a href="https://terapeutaeusou.com.br/privacidade">Política de Privacidade</a> · <a href="https://terapeutaeusou.com.br/ajuda">Central de Ajuda</a></p>
    </main>
  </body>
</html>`;
}

const accountParagraph = (value: string) =>
  `<p style="margin:0 0 16px;color:#3f3a68;font-family:Arial,sans-serif;font-size:16px;line-height:1.6">${value}</p>`;

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
    currentTemplateVersion: "v2",
    defaults: {
      subject: "Confirme seu e-mail para continuar no TES",
      preheader: "Falta apenas um passo para ativar sua conta.",
      text: "Olá, {{recipient_name}}.\n\nPara ativar sua conta e continuar no TES, confirme seu e-mail pelo link abaixo.\n\nConfirmar e-mail: {{verification_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Confirme seu e-mail",
        ctaLabel: "Confirmar e-mail",
        ctaUrlToken: "verification_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Falta apenas um passo para ativar sua conta e continuar no TES.",
          ),
          accountParagraph("Confirme seu e-mail pelo botão abaixo."),
        ].join(""),
      }),
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
    currentTemplateVersion: "v2",
    defaults: {
      subject: "Recebemos sua solicitação para redefinir sua senha",
      preheader:
        "Utilize o link abaixo para criar uma nova senha com segurança.",
      text: "Olá, {{recipient_name}}.\n\nRecebemos uma solicitação para redefinir sua senha. Use o link abaixo para criar uma nova senha com segurança.\n\nRedefinir senha: {{reset_url}}\n\nSe você não fez esta solicitação, pode ignorar esta mensagem.\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Redefina sua senha",
        ctaLabel: "Redefinir senha",
        ctaUrlToken: "reset_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos uma solicitação para redefinir sua senha.",
          ),
          accountParagraph(
            "Use o botão abaixo para criar uma nova senha com segurança. Se você não fez esta solicitação, pode ignorar esta mensagem.",
          ),
        ].join(""),
      }),
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
  registration_completed: {
    actionKey: "registration_completed",
    category: "Cadastro",
    label: "Cadastro concluído",
    description: "Confirma que a conta foi ativada no TES.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu cadastro foi concluído. Seja bem-vindo ao TES!",
      preheader: "Sua conta está pronta. Agora sua jornada pode começar.",
      text: "Olá, {{recipient_name}}.\n\nSeu cadastro foi concluído e sua conta está pronta para uso.\n\nAcessar minha conta: {{account_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu cadastro foi concluído",
        ctaLabel: "Acessar minha conta",
        ctaUrlToken: "account_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu cadastro foi concluído. Sua conta está pronta e sua jornada no TES pode começar.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "account_url", label: "Link da conta", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      account_url: "https://example.test/app",
    },
  },
  patient_welcome: {
    actionKey: "patient_welcome",
    category: "Cadastro",
    label: "Boas-vindas para pessoas",
    description:
      "Apresenta a jornada inicial para pacientes com conta ativada.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seja bem-vindo ao TES. Sua jornada começa agora.",
      preheader:
        "Estamos felizes por ter você conosco. Vamos dar o primeiro passo?",
      text: "Olá, {{recipient_name}}.\n\nEstamos felizes por ter você conosco. Sua jornada no TES começa agora.\n\nEncontrar um terapeuta: {{therapist_search_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seja bem-vindo ao TES",
        ctaLabel: "Encontrar um terapeuta",
        ctaUrlToken: "therapist_search_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Estamos felizes por ter você conosco. Vamos dar o primeiro passo da sua jornada?",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      {
        key: "therapist_search_url",
        label: "Link para encontrar terapeuta",
        kind: "url",
      },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      therapist_search_url: "https://example.test/terapeutas",
    },
  },
  therapist_welcome: {
    actionKey: "therapist_welcome",
    category: "Cadastro",
    label: "Boas-vindas para terapeutas",
    description:
      "Apresenta a jornada inicial para terapeutas com conta ativada.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seja bem-vindo ao TES. É uma alegria ter você conosco.",
      preheader: "Sua jornada como terapeuta no TES está começando.",
      text: "Olá, {{recipient_name}}.\n\nÉ uma alegria ter você conosco. Sua jornada como terapeuta no TES está começando.\n\nAcessar minha conta: {{account_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seja bem-vindo ao TES",
        ctaLabel: "Acessar minha conta",
        ctaUrlToken: "account_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "É uma alegria ter você conosco. Sua jornada como terapeuta no TES está começando.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "account_url", label: "Link da conta", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      account_url: "https://example.test/terapeuta",
    },
  },
  password_changed: {
    actionKey: "password_changed",
    category: "Acesso e segurança",
    label: "Senha alterada",
    description: "Confirma uma alteração de senha já concluída com segurança.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Sua senha foi alterada com sucesso",
      preheader:
        "Sua conta foi atualizada. Confira as informações desta alteração.",
      text: "Olá, {{recipient_name}}.\n\nSua senha foi alterada com sucesso. Se você não reconhece esta alteração, entre em contato com o suporte.\n\nEntrar em contato com o suporte: {{support_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Sua senha foi alterada",
        ctaLabel: "Entrar em contato com o suporte",
        ctaUrlToken: "support_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Sua senha foi alterada com sucesso."),
          accountParagraph(
            "Se você não reconhece esta alteração, entre em contato com o suporte.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "support_url", label: "Link de suporte", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      support_url: "https://example.test/ajuda",
    },
  },
  therapist_profile_submitted_for_review: {
    actionKey: "therapist_profile_submitted_for_review",
    category: "Terapeutas",
    label: "Perfil enviado para análise",
    description: "Confirma o recebimento do perfil profissional para análise.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Recebemos seu perfil. Agora ele será analisado.",
      preheader:
        "Seu cadastro profissional foi recebido e já está em processo de análise.",
      text: "Olá, {{recipient_name}}.\n\nRecebemos seu perfil profissional. Agora ele será analisado pela equipe do TES.\n\nAcompanhar análise: {{profile_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Recebemos seu perfil",
        ctaLabel: "Acompanhar análise",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos seu cadastro profissional e ele já está em processo de análise.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "profile_url", label: "Link do perfil", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      profile_url: "https://example.test/terapeuta/perfil",
    },
  },
  therapist_documents_requested: {
    actionKey: "therapist_documents_requested",
    category: "Terapeutas",
    label: "Solicitação de informações",
    description:
      "Informa que a análise do perfil requer uma ação na área autenticada.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject:
        "Precisamos de algumas informações para continuar a análise do seu perfil",
      preheader:
        "Recebemos seu cadastro e precisamos da sua ajuda para concluir a análise.",
      text: "Olá, {{recipient_name}}.\n\nPrecisamos de algumas informações para continuar a análise do seu perfil. Consulte as orientações na sua área autenticada.\n\nEnviar informações: {{profile_edit_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Precisamos de algumas informações",
        ctaLabel: "Enviar informações",
        ctaUrlToken: "profile_edit_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Precisamos da sua ajuda para concluir a análise do seu perfil.",
          ),
          accountParagraph("Consulte as orientações na sua área autenticada."),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      {
        key: "profile_edit_url",
        label: "Link para editar o perfil",
        kind: "url",
      },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      profile_edit_url: "https://example.test/terapeuta/perfil/editar",
    },
  },
  therapist_profile_approved: {
    actionKey: "therapist_profile_approved",
    category: "Terapeutas",
    label: "Perfil aprovado",
    description: "Confirma a aprovação persistida de um perfil profissional.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu perfil foi aprovado. Seja bem-vindo ao TES!",
      preheader: "Seu perfil já faz parte da nossa comunidade de terapeutas.",
      text: "Olá, {{recipient_name}}.\n\nSeu perfil foi aprovado e já faz parte da comunidade de terapeutas do TES.\n\nAcessar meu painel: {{dashboard_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu perfil foi aprovado",
        ctaLabel: "Acessar meu painel",
        ctaUrlToken: "dashboard_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu perfil foi aprovado e já faz parte da nossa comunidade de terapeutas.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "dashboard_url", label: "Link do painel", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      dashboard_url: "https://example.test/terapeuta",
    },
  },
  therapist_profile_rejected: {
    actionKey: "therapist_profile_rejected",
    category: "Terapeutas",
    label: "Perfil reprovado",
    description:
      "Comunica uma decisão de análise sem expor justificativa por e-mail.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Concluímos a análise do seu perfil",
      preheader:
        "A análise foi finalizada. Confira as informações sobre o seu cadastro.",
      text: "Olá, {{recipient_name}}.\n\nConcluímos a análise do seu perfil. Consulte as orientações na sua área autenticada.\n\nConsultar orientações: {{profile_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Concluímos a análise do seu perfil",
        ctaLabel: "Consultar orientações",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Concluímos a análise do seu perfil."),
          accountParagraph("Consulte as orientações na sua área autenticada."),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "profile_url", label: "Link do perfil", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      profile_url: "https://example.test/terapeuta/perfil",
    },
  },
  therapist_profile_suspended: {
    actionKey: "therapist_profile_suspended",
    category: "Terapeutas",
    label: "Perfil suspenso",
    description:
      "Comunica uma suspensão persistida sem expor o motivo por e-mail.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu perfil foi suspenso temporariamente",
      preheader: "Confira as informações sobre a suspensão do seu perfil.",
      text: "Olá, {{recipient_name}}.\n\nSeu perfil foi suspenso temporariamente. Consulte sua situação na área autenticada.\n\nConsultar minha situação: {{profile_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu perfil foi suspenso",
        ctaLabel: "Consultar minha situação",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Seu perfil foi suspenso temporariamente."),
          accountParagraph("Consulte as informações na sua área autenticada."),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "profile_url", label: "Link do perfil", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      profile_url: "https://example.test/terapeuta/perfil",
    },
  },
  therapist_profile_reactivated: {
    actionKey: "therapist_profile_reactivated",
    category: "Terapeutas",
    label: "Perfil reativado",
    description: "Confirma a reativação persistida de um perfil profissional.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu perfil foi reativado no TES",
      preheader:
        "Seu perfil voltou a estar ativo e já pode ser utilizado normalmente.",
      text: "Olá, {{recipient_name}}.\n\nSeu perfil foi reativado no TES e já pode ser utilizado normalmente.\n\nAcessar meu painel: {{dashboard_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu perfil foi reativado",
        ctaLabel: "Acessar meu painel",
        ctaUrlToken: "dashboard_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu perfil voltou a estar ativo e já pode ser utilizado normalmente.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: [
      ...accountTokens,
      { key: "dashboard_url", label: "Link do painel", kind: "url" },
    ],
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      dashboard_url: "https://example.test/terapeuta",
    },
  },
  booking_confirmed_patient: {
    actionKey: "booking_confirmed_patient",
    category: "Encontros",
    label: "Encontro confirmado — pessoa",
    description: "Confirma um encontro após o pagamento e o estado persistido.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi confirmado",
      preheader: "Está tudo certo. Confira as informações do seu agendamento.",
      text: "Olá, {{recipient_name}}.\n\nSeu encontro com {{counterparty_name}} foi confirmado.\n\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer encontro: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi confirmado",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu encontro com {{counterparty_name}} foi confirmado.",
          ),
          accountParagraph(
            "Terapia: {{service_title}}<br>Data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      counterparty_name: "Terapeuta de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "20 de agosto de 2026 às 15:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/app/encontros/exemplo",
    },
  },
  booking_confirmed_therapist: {
    actionKey: "booking_confirmed_therapist",
    category: "Encontros",
    label: "Sessão confirmada — terapeuta",
    description: "Confirma uma sessão após o pagamento e o estado persistido.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi confirmado",
      preheader: "Está tudo certo. Confira as informações do seu agendamento.",
      text: "Olá, {{recipient_name}}.\n\nSeu encontro com {{counterparty_name}} foi confirmado.\n\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer sessão: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi confirmado",
        ctaLabel: "Ver sessão",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu encontro com {{counterparty_name}} foi confirmado.",
          ),
          accountParagraph(
            "Terapia: {{service_title}}<br>Data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      counterparty_name: "Pessoa de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "20 de agosto de 2026 às 15:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/terapeuta/sessoes/exemplo",
    },
  },
  booking_cancelled_patient: {
    actionKey: "booking_cancelled_patient",
    category: "Encontros",
    label: "Encontro cancelado — pessoa",
    description: "Confirma um cancelamento já persistido, sem expor motivo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi cancelado",
      preheader: "O cancelamento foi confirmado. Confira as informações atualizadas.",
      text: "Olá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi cancelado.\n\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer meus encontros: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi cancelado",
        ctaLabel: "Ver meus encontros",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("O encontro com {{counterparty_name}} foi cancelado."),
          accountParagraph(
            "Terapia: {{service_title}}<br>Data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      counterparty_name: "Terapeuta de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "20 de agosto de 2026 às 15:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/app/encontros/exemplo",
    },
  },
  booking_cancelled_therapist: {
    actionKey: "booking_cancelled_therapist",
    category: "Encontros",
    label: "Sessão cancelada — terapeuta",
    description: "Confirma um cancelamento já persistido, sem expor motivo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi cancelado",
      preheader: "O cancelamento foi confirmado. Confira as informações atualizadas.",
      text: "Olá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi cancelado.\n\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer sessões: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi cancelado",
        ctaLabel: "Ver sessões",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("O encontro com {{counterparty_name}} foi cancelado."),
          accountParagraph(
            "Terapia: {{service_title}}<br>Data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      counterparty_name: "Pessoa de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "20 de agosto de 2026 às 15:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/terapeuta/sessoes/exemplo",
    },
  },
  booking_rescheduled_patient: {
    actionKey: "booking_rescheduled_patient",
    category: "Encontros",
    label: "Encontro reagendado — pessoa",
    description: "Confirma um reagendamento aplicado de forma persistida.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi reagendado",
      preheader: "O reagendamento foi confirmado. Confira a nova data e horário.",
      text: "Olá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi reagendado.\n\nTerapia: {{service_title}}\nNova data e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer encontro: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi reagendado",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("O encontro com {{counterparty_name}} foi reagendado."),
          accountParagraph(
            "Terapia: {{service_title}}<br>Nova data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      counterparty_name: "Terapeuta de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "21 de agosto de 2026 às 16:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/app/encontros/exemplo",
    },
  },
  booking_rescheduled_therapist: {
    actionKey: "booking_rescheduled_therapist",
    category: "Encontros",
    label: "Sessão reagendada — terapeuta",
    description: "Confirma um reagendamento aplicado de forma persistida.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro foi reagendado",
      preheader: "O reagendamento foi confirmado. Confira a nova data e horário.",
      text: "Olá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi reagendado.\n\nTerapia: {{service_title}}\nNova data e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVer sessão: {{encounter_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu encontro foi reagendado",
        ctaLabel: "Ver sessão",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("O encontro com {{counterparty_name}} foi reagendado."),
          accountParagraph(
            "Terapia: {{service_title}}<br>Nova data e horário: {{meeting_date_time}} ({{meeting_timezone}})",
          ),
        ].join(""),
      }),
    },
    allowedTokens: bookingTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      counterparty_name: "Pessoa de exemplo",
      service_title: "Terapia de exemplo",
      meeting_date_time: "21 de agosto de 2026 às 16:00",
      meeting_timezone: "America/Sao_Paulo",
      encounter_url: "https://example.test/terapeuta/sessoes/exemplo",
    },
  },
  session_payment_approved: {
    actionKey: "session_payment_approved",
    category: "Financeiro",
    label: "Pagamento aprovado",
    description: "Confirma um pagamento depois do estado financeiro autoritativo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Pagamento confirmado com sucesso",
      preheader: "Recebemos seu pagamento. Confira as informações da sua transação.",
      text: "Olá, {{recipient_name}}.\n\nRecebemos seu pagamento de {{amount}} para {{service_title}}.\n\nVer detalhes: {{payment_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Pagamento confirmado com sucesso",
        ctaLabel: "Ver detalhes",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos seu pagamento de {{amount}} para {{service_title}}.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: paymentTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      amount: "R$ 150,00",
      service_title: "Terapia de exemplo",
      payment_url: "https://example.test/app/pagamentos",
    },
  },
  session_payment_declined: {
    actionKey: "session_payment_declined",
    category: "Financeiro",
    label: "Pagamento recusado",
    description: "Orienta uma nova tentativa após uma recusa financeira persistida.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Não foi possível concluir seu pagamento",
      preheader: "Sua transação não foi aprovada. Confira como continuar.",
      text: "Olá, {{recipient_name}}.\n\nNão foi possível concluir o pagamento para {{service_title}}. Você pode acessar o encontro para tentar novamente.\n\nTentar novamente: {{payment_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Não foi possível concluir seu pagamento",
        ctaLabel: "Tentar novamente",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Não foi possível concluir o pagamento para {{service_title}}.",
          ),
          accountParagraph(
            "Você pode acessar o encontro para tentar novamente.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: paymentTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      amount: "R$ 150,00",
      service_title: "Terapia de exemplo",
      payment_url: "https://example.test/app/encontros/exemplo",
    },
  },
  session_payment_pending: {
    actionKey: "session_payment_pending",
    category: "Financeiro",
    label: "Pagamento pendente",
    description: "Comunica que o pagamento está em processamento autoritativo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu pagamento está em processamento",
      preheader:
        "Recebemos sua solicitação e estamos aguardando a confirmação do pagamento.",
      text: "Olá, {{recipient_name}}.\n\nRecebemos sua solicitação de pagamento de {{amount}} para {{service_title}} e aguardamos a confirmação.\n\nAcompanhar pagamento: {{payment_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu pagamento está em processamento",
        ctaLabel: "Acompanhar pagamento",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos sua solicitação de pagamento de {{amount}} para {{service_title}}.",
          ),
          accountParagraph("Aguardamos a confirmação do pagamento."),
        ].join(""),
      }),
    },
    allowedTokens: paymentTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      amount: "R$ 150,00",
      service_title: "Terapia de exemplo",
      payment_url: "https://example.test/app/pagamentos",
    },
  },
  session_refund_approved: {
    actionKey: "session_refund_approved",
    category: "Financeiro",
    label: "Reembolso aprovado",
    description: "Comunica somente um reembolso confirmado pelo provider.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu reembolso foi aprovado",
      preheader:
        "Sua solicitação foi aprovada e o processo de devolução já foi iniciado.",
      text: "Olá, {{recipient_name}}.\n\nSeu reembolso de {{amount}} foi aprovado e o processo de devolução já foi iniciado.\n\nVer detalhes: {{refund_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu reembolso foi aprovado",
        ctaLabel: "Ver detalhes",
        ctaUrlToken: "refund_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu reembolso de {{amount}} foi aprovado e o processo de devolução já foi iniciado.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: refundTokens,
    previewFixture: {
      recipient_name: "Pessoa de exemplo",
      amount: "R$ 150,00",
      refund_url: "https://example.test/app/pagamentos",
    },
  },
  therapist_payout_completed: {
    actionKey: "therapist_payout_completed",
    category: "Financeiro",
    label: "Repasse realizado ao terapeuta",
    description: "Confirma um repasse persistido após aceite do provider.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu repasse foi realizado",
      preheader:
        "O valor referente aos seus atendimentos já foi processado.",
      text: "Olá, {{recipient_name}}.\n\nO repasse de {{amount}} referente aos seus atendimentos já foi processado.\n\nVer painel financeiro: {{finance_url}}\n\nEquipe TES",
      html: defaultEmailHtml({
        title: "Seu repasse foi realizado",
        ctaLabel: "Ver painel financeiro",
        ctaUrlToken: "finance_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "O repasse de {{amount}} referente aos seus atendimentos já foi processado.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: payoutTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      amount: "R$ 120,00",
      finance_url: "https://example.test/terapeuta/financeiro",
    },
  },
  therapist_subscription_created: {
    actionKey: "therapist_subscription_created",
    category: "Assinaturas",
    label: "Assinatura criada",
    description: "Confirma a ativação persistida de uma assinatura.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Sua assinatura está ativa",
      preheader:
        "Seu plano foi ativado com sucesso. Confira as informações da sua assinatura.",
      text: "Sua assinatura foi ativada.\n\nOlá, {{recipient_name}}.\n\nSua assinatura no TES foi criada com sucesso e já está ativa.\n\nA partir deste momento, você passa a ter acesso aos recursos e benefícios disponíveis no plano contratado.\n\nResumo da assinatura:\nPlano: {{plan_name}}\nData de ativação: {{date}}\nPróxima renovação: {{next_renewal_date}}\n\nVocê pode consultar os detalhes da sua assinatura, acompanhar o histórico de cobranças e gerenciar seu plano diretamente pelo painel da plataforma.\n\nAgradecemos por confiar no TES para fazer parte da sua jornada profissional.\n\nEquipe TES\n\nGerenciar assinatura: {{subscription_url}}",
      html: defaultEmailHtml({
        title: "Sua assinatura foi ativada.",
        ctaLabel: "Gerenciar assinatura",
        ctaUrlToken: "subscription_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Sua assinatura no TES foi criada com sucesso e já está ativa.",
          ),
          accountParagraph(
            "A partir deste momento, você passa a ter acesso aos recursos e benefícios disponíveis no plano contratado.",
          ),
          accountParagraph(
            "<strong>Resumo da assinatura:</strong><br>Plano: {{plan_name}}<br>Data de ativação: {{date}}<br>Próxima renovação: {{next_renewal_date}}",
          ),
          accountParagraph(
            "Você pode consultar os detalhes da sua assinatura, acompanhar o histórico de cobranças e gerenciar seu plano diretamente pelo painel da plataforma.",
          ),
          accountParagraph(
            "Agradecemos por confiar no TES para fazer parte da sua jornada profissional.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: subscriptionTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      plan_name: "Premium",
      date: "20 de agosto de 2026",
      next_renewal_date: "20 de setembro de 2026",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
    },
  },
  therapist_subscription_renewed: {
    actionKey: "therapist_subscription_renewed",
    category: "Assinaturas",
    label: "Assinatura renovada",
    description: "Confirma uma cobrança recorrente já persistida.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Sua assinatura foi renovada com sucesso",
      preheader:
        "Seu plano continua ativo. Confira as informações da renovação.",
      text: "Sua assinatura foi renovada.\n\nOlá, {{recipient_name}}.\n\nSua assinatura no TES foi renovada com sucesso.\n\nA renovação garante a continuidade do seu plano e mantém o acesso aos recursos e benefícios disponíveis na sua assinatura.\n\nResumo da renovação:\nPlano: {{plan_name}}\nData da renovação: {{date}}\nPróxima renovação prevista: {{next_renewal_date}}\n\nNenhuma ação é necessária neste momento. Você pode continuar utilizando normalmente todos os recursos disponíveis de acordo com o seu plano.\n\nAgradecemos por seguir construindo essa jornada conosco.\n\nEquipe TES\n\nVer minha assinatura: {{subscription_url}}",
      html: defaultEmailHtml({
        title: "Sua assinatura foi renovada.",
        ctaLabel: "Ver minha assinatura",
        ctaUrlToken: "subscription_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Sua assinatura no TES foi renovada com sucesso.",
          ),
          accountParagraph(
            "A renovação garante a continuidade do seu plano e mantém o acesso aos recursos e benefícios disponíveis na sua assinatura.",
          ),
          accountParagraph(
            "<strong>Resumo da renovação:</strong><br>Plano: {{plan_name}}<br>Data da renovação: {{date}}<br>Próxima renovação prevista: {{next_renewal_date}}",
          ),
          accountParagraph(
            "Nenhuma ação é necessária neste momento. Você pode continuar utilizando normalmente todos os recursos disponíveis de acordo com o seu plano.",
          ),
          accountParagraph(
            "Agradecemos por seguir construindo essa jornada conosco.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: subscriptionTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      plan_name: "Premium",
      date: "20 de agosto de 2026",
      next_renewal_date: "20 de setembro de 2026",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
    },
  },
  therapist_subscription_cancelled: {
    actionKey: "therapist_subscription_cancelled",
    category: "Assinaturas",
    label: "Assinatura cancelada",
    description: "Confirma um cancelamento efetivado, sem expor o motivo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Sua assinatura foi cancelada",
      preheader:
        "Seu plano foi encerrado. Confira as informações da sua assinatura.",
      text: "Sua assinatura foi cancelada.\n\nOlá, {{recipient_name}}.\n\nInformamos que sua assinatura no TES foi cancelada.\n\nA partir da data de encerramento, sua conta passará a utilizar os recursos correspondentes ao plano disponível após o cancelamento, conforme as regras da plataforma.\n\nResumo da alteração:\nPlano anterior: {{plan_name}}\nData do cancelamento: {{date}}\nStatus atual: {{account_status}}\n\nCaso deseje contratar novamente um plano ou conhecer outras opções de assinatura, isso poderá ser feito a qualquer momento diretamente pela plataforma.\n\nAgradecemos por ter feito parte da comunidade do TES e esperamos ter a oportunidade de continuar essa jornada com você no futuro.\n\nEquipe TES\n\nGerenciar assinatura: {{subscription_url}}",
      html: defaultEmailHtml({
        title: "Sua assinatura foi cancelada.",
        ctaLabel: "Gerenciar assinatura",
        ctaUrlToken: "subscription_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Informamos que sua assinatura no TES foi cancelada."),
          accountParagraph(
            "A partir da data de encerramento, sua conta passará a utilizar os recursos correspondentes ao plano disponível após o cancelamento, conforme as regras da plataforma.",
          ),
          accountParagraph(
            "<strong>Resumo da alteração:</strong><br>Plano anterior: {{plan_name}}<br>Data do cancelamento: {{date}}<br>Status atual: {{account_status}}",
          ),
          accountParagraph(
            "Caso deseje contratar novamente um plano ou conhecer outras opções de assinatura, isso poderá ser feito a qualquer momento diretamente pela plataforma.",
          ),
          accountParagraph(
            "Agradecemos por ter feito parte da comunidade do TES e esperamos ter a oportunidade de continuar essa jornada com você no futuro.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: subscriptionCancellationTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      plan_name: "Premium",
      date: "20 de agosto de 2026",
      account_status: "Plano Free",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
    },
  },
  therapist_subscription_plan_changed: {
    actionKey: "therapist_subscription_plan_changed",
    category: "Assinaturas",
    label: "Alteração de plano",
    description: "Confirma uma mudança de plano já efetivada no estado autoritativo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu plano foi atualizado",
      preheader: "A alteração da sua assinatura foi concluída com sucesso.",
      text: "Seu plano foi atualizado.\n\nOlá, {{recipient_name}}.\n\nA alteração da sua assinatura no TES foi concluída com sucesso.\n\nA partir deste momento, sua conta passa a utilizar os recursos e benefícios correspondentes ao novo plano contratado.\n\nResumo da alteração:\nNovo plano: {{new_plan_name}}\nData da alteração: {{date}}\nPróxima renovação: {{next_renewal_date}}\n\nAs funcionalidades disponíveis serão atualizadas automaticamente conforme as características do novo plano.\n\nVocê poderá consultar todos os detalhes da sua assinatura e dos benefícios disponíveis diretamente na área de gerenciamento da plataforma.\n\nAgradecemos por continuar fazendo parte da comunidade do TES.\n\nEquipe TES\n\nVer minha assinatura: {{subscription_url}}",
      html: defaultEmailHtml({
        title: "Seu plano foi atualizado.",
        ctaLabel: "Ver minha assinatura",
        ctaUrlToken: "subscription_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "A alteração da sua assinatura no TES foi concluída com sucesso.",
          ),
          accountParagraph(
            "A partir deste momento, sua conta passa a utilizar os recursos e benefícios correspondentes ao novo plano contratado.",
          ),
          accountParagraph(
            "<strong>Resumo da alteração:</strong><br>Novo plano: {{new_plan_name}}<br>Data da alteração: {{date}}<br>Próxima renovação: {{next_renewal_date}}",
          ),
          accountParagraph(
            "As funcionalidades disponíveis serão atualizadas automaticamente conforme as características do novo plano.",
          ),
          accountParagraph(
            "Você poderá consultar todos os detalhes da sua assinatura e dos benefícios disponíveis diretamente na área de gerenciamento da plataforma.",
          ),
          accountParagraph(
            "Agradecemos por continuar fazendo parte da comunidade do TES.",
          ),
        ].join(""),
      }),
    },
    allowedTokens: subscriptionPlanChangeTokens,
    previewFixture: {
      recipient_name: "Terapeuta de exemplo",
      new_plan_name: "Premium Plus",
      date: "20 de agosto de 2026",
      next_renewal_date: "20 de setembro de 2026",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
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
