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

const payoutIncidentTokens = [
  { key: "recipient_name", label: "Nome do administrador" },
  { key: "incident_type", label: "Tipo da ocorrência" },
  { key: "admin_url", label: "Link de pagamentos", kind: "url" },
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
  <body style="margin:0;padding:0;background-color:#f7f4fb">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#f7f4fb">
      <tbody>
        <tr>
          <td align="center" style="padding:32px 16px">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border:1px solid #e7daf2;border-radius:24px;background-color:#ffffff">
              <tbody>
                <tr>
                  <td style="padding:32px 32px 32px">
                    <h1 style="margin:0 0 24px;color:#14105a;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;line-height:1.15">${input.title}</h1>
                    ${input.body}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:28px 0 0">
                      <tbody><tr><td align="center" style="border-radius:999px;background-color:#6c3d91"><a href="{{${input.ctaUrlToken}}}" style="display:inline-block;padding:14px 22px;border-radius:999px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none">${input.ctaLabel}</a></td></tr></tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px;border-top:1px solid #eee8f3">
                    <p style="margin:0;color:#6f6a8f;font-family:Arial,sans-serif;font-size:13px;line-height:1.6">Equipe TES</p>
                    <p style="margin:12px 0 0;color:#6f6a8f;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">Terapeuta Eu Sou · <a href="https://terapeutaeusou.com.br/termos" style="color:#6c3d91;text-decoration:underline">Termos de Uso</a> · <a href="https://terapeutaeusou.com.br/privacidade" style="color:#6c3d91;text-decoration:underline">Política de Privacidade</a> · <a href="https://terapeutaeusou.com.br/ajuda" style="color:#6c3d91;text-decoration:underline">Central de Ajuda</a></p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
}

const accountParagraph = (value: string) =>
  `<p style="margin:0 0 16px;color:#3f3a68;font-family:Arial,sans-serif;font-size:16px;line-height:1.6">${value}</p>`;

const emailDetailList = (items: ReadonlyArray<readonly [string, string]>) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px;border:1px solid #eee8f3;border-radius:12px;background-color:#fbfaff"><tbody>${items.map(([label, value]) => `<tr><td style="padding:10px 14px;color:#6f6a8f;font-family:Arial,sans-serif;font-size:13px;line-height:1.45">${label}</td><td align="right" style="padding:10px 14px;color:#32295b;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.45">${value}</td></tr>`).join("")}</tbody></table>`;

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
      text: "Vamos confirmar seu e-mail.\n\nOlá, {{recipient_name}}.\n\nEstamos muito felizes por você estar iniciando sua jornada no TES. Para proteger sua conta e garantir que possamos nos comunicar com você sempre que necessário, precisamos confirmar o endereço de e-mail informado durante o cadastro.\n\nBasta clicar no link abaixo para concluir a verificação. Após a confirmação, sua conta estará pronta para seguir para as próximas etapas da plataforma.\n\nCaso você não tenha realizado este cadastro, basta desconsiderar esta mensagem. Nenhuma ação será realizada sem a confirmação do endereço de e-mail.\n\nConte com a gente durante toda a sua jornada.\n\nEquipe TES\n\nConfirmar e-mail: {{verification_url}}",
      html: defaultEmailHtml({
        title: "Vamos confirmar seu e-mail.",
        ctaLabel: "Confirmar e-mail",
        ctaUrlToken: "verification_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Estamos muito felizes por você estar iniciando sua jornada no TES. Para proteger sua conta e garantir que possamos nos comunicar com você sempre que necessário, precisamos confirmar o endereço de e-mail informado durante o cadastro.",
          ),
          accountParagraph(
            "Basta clicar no botão abaixo para concluir a verificação. Após a confirmação, sua conta estará pronta para seguir para as próximas etapas da plataforma.",
          ),
          accountParagraph(
            "Caso você não tenha realizado este cadastro, basta desconsiderar esta mensagem. Nenhuma ação será realizada sem a confirmação do endereço de e-mail. Conte com a gente durante toda a sua jornada.",
          ),
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
      text: "Vamos ajudar você a recuperar o acesso à sua conta.\n\nOlá, {{recipient_name}}.\n\nRecebemos uma solicitação para redefinir a senha da sua conta no TES.\n\nSe foi você quem fez essa solicitação, basta usar o link abaixo para criar uma nova senha e voltar a acessar sua conta com segurança.\n\nCaso você não tenha solicitado essa alteração, não é necessário realizar nenhuma ação. Sua senha permanecerá a mesma e sua conta continuará protegida.\n\nPor motivos de segurança, o link para redefinição possui prazo de validade e poderá ser utilizado apenas uma vez.\n\nSe precisar de ajuda, nossa equipe estará à disposição.\n\nEquipe TES\n\nRedefinir senha: {{reset_url}}",
      html: defaultEmailHtml({
        title: "Vamos ajudar você a recuperar o acesso à sua conta.",
        ctaLabel: "Redefinir senha",
        ctaUrlToken: "reset_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos uma solicitação para redefinir a senha da sua conta no TES.",
          ),
          accountParagraph(
            "Se foi você quem fez essa solicitação, basta clicar no botão abaixo para criar uma nova senha e voltar a acessar sua conta com segurança.",
          ),
          accountParagraph(
            "Caso você não tenha solicitado essa alteração, não é necessário realizar nenhuma ação. Sua senha permanecerá a mesma e sua conta continuará protegida.",
          ),
          accountParagraph(
            "Por motivos de segurança, o link para redefinição possui prazo de validade e poderá ser utilizado apenas uma vez. Se precisar de ajuda, nossa equipe estará à disposição.",
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
      text: "Seja bem-vindo ao TES.\n\nOlá, {{recipient_name}}.\n\nSeu cadastro foi concluído com sucesso e sua conta já está pronta para uso. É uma alegria receber você na comunidade do TES.\n\nA partir de agora, você poderá acessar a plataforma e aproveitar os recursos disponíveis para a sua jornada. Se você é uma pessoa em busca de um terapeuta, poderá conhecer profissionais e encontrar aquele que mais faz sentido para o seu momento. Se você é terapeuta, poderá acompanhar as próximas etapas do seu processo e preparar seu perfil para receber pessoas.\n\nQueremos que sua experiência seja simples, segura e acolhedora desde o primeiro acesso. Sempre que precisar, nossa equipe estará disponível para ajudar.\n\nDesejamos que este seja o início de uma jornada repleta de boas conexões.\n\nEquipe TES\n\nAcessar minha conta: {{account_url}}",
      html: defaultEmailHtml({
        title: "Seja bem-vindo ao TES.",
        ctaLabel: "Acessar minha conta",
        ctaUrlToken: "account_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu cadastro foi concluído com sucesso e sua conta já está pronta para uso. É uma alegria receber você na comunidade do TES.",
          ),
          accountParagraph(
            "A partir de agora, você poderá acessar a plataforma e aproveitar os recursos disponíveis para a sua jornada. Se você é uma pessoa em busca de um terapeuta, poderá conhecer profissionais e encontrar aquele que mais faz sentido para o seu momento. Se você é terapeuta, poderá acompanhar as próximas etapas do seu processo e preparar seu perfil para receber pessoas.",
          ),
          accountParagraph(
            "Queremos que sua experiência seja simples, segura e acolhedora desde o primeiro acesso. Sempre que precisar, nossa equipe estará disponível para ajudar. Desejamos que este seja o início de uma jornada repleta de boas conexões.",
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
      text: "É uma alegria receber você no TES.\n\nOlá, {{recipient_name}}.\n\nSeja muito bem-vindo. A partir de agora, você faz parte de uma comunidade criada para aproximar pessoas de terapeutas, tornando essa jornada mais simples, segura e acolhedora.\n\nNo TES, acreditamos que cada pessoa vive um momento diferente e que encontrar o terapeuta certo pode fazer toda a diferença nessa caminhada. Por isso, desenvolvemos uma plataforma que respeita sua individualidade e oferece liberdade para que você escolha o profissional que mais faz sentido para você.\n\nAgora que sua conta está ativa, você já pode conhecer terapeutas, explorar diferentes práticas e, quando sentir que encontrou o profissional ideal, agendar seu primeiro encontro.\n\nNão tenha pressa. Permita-se conhecer, explorar e encontrar o caminho que melhor conversa com o seu momento.\n\nEsperamos que esta seja a primeira de muitas boas experiências dentro do TES. Conte conosco sempre que precisar.\n\nEquipe TES\n\nEncontrar um terapeuta: {{therapist_search_url}}",
      html: defaultEmailHtml({
        title: "É uma alegria receber você no TES.",
        ctaLabel: "Encontrar um terapeuta",
        ctaUrlToken: "therapist_search_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seja muito bem-vindo. A partir de agora, você faz parte de uma comunidade criada para aproximar pessoas de terapeutas, tornando essa jornada mais simples, segura e acolhedora.",
          ),
          accountParagraph(
            "No TES, acreditamos que cada pessoa vive um momento diferente e que encontrar o terapeuta certo pode fazer toda a diferença nessa caminhada. Por isso, desenvolvemos uma plataforma que respeita sua individualidade e oferece liberdade para que você escolha o profissional que mais faz sentido para você.",
          ),
          accountParagraph(
            "Agora que sua conta está ativa, você já pode conhecer terapeutas, explorar diferentes práticas e, quando sentir que encontrou o profissional ideal, agendar seu primeiro encontro.",
          ),
          accountParagraph(
            "Não tenha pressa. Permita-se conhecer, explorar e encontrar o caminho que melhor conversa com o seu momento. Esperamos que esta seja a primeira de muitas boas experiências dentro do TES. Conte conosco sempre que precisar.",
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
      text: "Seja bem-vindo ao TES.\n\nOlá, {{recipient_name}}.\n\nÉ uma alegria receber você na comunidade de terapeutas do TES. A partir de agora, você faz parte de uma plataforma criada para aproximar terapeutas e pessoas por meio de conexões mais humanas, respeitando a essência de cada profissional e a liberdade de cada prática.\n\nAqui, acreditamos que o seu trabalho merece um espaço onde possa ser apresentado com autenticidade, sem abrir mão da sua identidade e da forma como você escolheu exercer sua prática.\n\nNos próximos passos, você poderá organizar seu perfil, conhecer os recursos disponíveis na plataforma e acompanhar todas as etapas necessárias para começar a receber pessoas.\n\nEsperamos que o TES seja um parceiro no crescimento da sua jornada profissional e que possamos construir essa história juntos. Conte conosco sempre que precisar.\n\nEquipe TES\n\nAcessar minha conta: {{account_url}}",
      html: defaultEmailHtml({
        title: "Seja bem-vindo ao TES.",
        ctaLabel: "Acessar minha conta",
        ctaUrlToken: "account_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "É uma alegria receber você na comunidade de terapeutas do TES. A partir de agora, você faz parte de uma plataforma criada para aproximar terapeutas e pessoas por meio de conexões mais humanas, respeitando a essência de cada profissional e a liberdade de cada prática.",
          ),
          accountParagraph(
            "Aqui, acreditamos que o seu trabalho merece um espaço onde possa ser apresentado com autenticidade, sem abrir mão da sua identidade e da forma como você escolheu exercer sua prática.",
          ),
          accountParagraph(
            "Nos próximos passos, você poderá organizar seu perfil, conhecer os recursos disponíveis na plataforma e acompanhar todas as etapas necessárias para começar a receber pessoas.",
          ),
          accountParagraph(
            "Esperamos que o TES seja um parceiro no crescimento da sua jornada profissional e que possamos construir essa história juntos. Conte conosco sempre que precisar.",
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
      text: "Sua senha foi alterada.\n\nOlá, {{recipient_name}}.\n\nInformamos que a senha da sua conta no TES foi alterada com sucesso. A partir deste momento, sua nova senha já está ativa e deverá ser utilizada em todos os próximos acessos à plataforma.\n\nCaso tenha sido você quem realizou essa alteração, nenhuma outra ação é necessária.\n\nSe você não reconhece essa alteração, recomendamos que entre em contato com nossa equipe imediatamente para que possamos ajudar a proteger sua conta.\n\nA segurança das suas informações é uma prioridade para o TES.\n\nEquipe TES\n\nEntrar em contato com o suporte: {{support_url}}",
      html: defaultEmailHtml({
        title: "Sua senha foi alterada.",
        ctaLabel: "Entrar em contato com o suporte",
        ctaUrlToken: "support_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Informamos que a senha da sua conta no TES foi alterada com sucesso. A partir deste momento, sua nova senha já está ativa e deverá ser utilizada em todos os próximos acessos à plataforma.",
          ),
          accountParagraph(
            "Caso tenha sido você quem realizou essa alteração, nenhuma outra ação é necessária. Se você não reconhece essa alteração, recomendamos que entre em contato com nossa equipe imediatamente para que possamos ajudar a proteger sua conta. A segurança das suas informações é uma prioridade para o TES.",
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
      text: "Recebemos seu perfil.\n\nOlá, {{recipient_name}}.\n\nRecebemos todas as informações enviadas para o seu cadastro profissional no TES. A partir de agora, seu perfil será analisado pela nossa equipe para verificar se ele atende aos critérios e às políticas da plataforma.\n\nDurante esse período, não é necessário realizar nenhuma ação adicional, salvo se entrarmos em contato solicitando alguma informação complementar.\n\nAssim que a análise for concluída, enviaremos uma nova comunicação informando o resultado e os próximos passos.\n\nAgradecemos pela confiança e por escolher fazer parte da comunidade de terapeutas do TES.\n\nEquipe TES\n\nAcompanhar análise: {{profile_url}}",
      html: defaultEmailHtml({
        title: "Recebemos seu perfil.",
        ctaLabel: "Acompanhar análise",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos todas as informações enviadas para o seu cadastro profissional no TES. A partir de agora, seu perfil será analisado pela nossa equipe para verificar se ele atende aos critérios e às políticas da plataforma.",
          ),
          accountParagraph(
            "Durante esse período, não é necessário realizar nenhuma ação adicional, salvo se entrarmos em contato solicitando alguma informação complementar.",
          ),
          accountParagraph(
            "Assim que a análise for concluída, enviaremos uma nova comunicação informando o resultado e os próximos passos. Agradecemos pela confiança e por escolher fazer parte da comunidade de terapeutas do TES.",
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
      text: "Vamos continuar sua análise.\n\nOlá, {{recipient_name}}.\n\nDurante a análise do seu perfil no TES, identificamos a necessidade de complementar algumas informações antes de concluirmos essa etapa.\n\nPara que possamos dar continuidade ao processo, pedimos que acesse sua conta e verifique as solicitações disponíveis. Assim que as informações forem enviadas, nossa equipe retomará a análise do seu perfil.\n\nEssa etapa faz parte do nosso compromisso em manter uma plataforma segura, organizada e transparente para terapeutas e pessoas.\n\nSe tiver qualquer dúvida durante o processo, nossa equipe estará à disposição para ajudar. Agradecemos pela sua colaboração.\n\nEquipe TES\n\nEnviar informações: {{profile_edit_url}}",
      html: defaultEmailHtml({
        title: "Vamos continuar sua análise.",
        ctaLabel: "Enviar informações",
        ctaUrlToken: "profile_edit_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Durante a análise do seu perfil no TES, identificamos a necessidade de complementar algumas informações antes de concluirmos essa etapa.",
          ),
          accountParagraph(
            "Para que possamos dar continuidade ao processo, pedimos que acesse sua conta e verifique as solicitações disponíveis. Assim que as informações forem enviadas, nossa equipe retomará a análise do seu perfil.",
          ),
          accountParagraph(
            "Essa etapa faz parte do nosso compromisso em manter uma plataforma segura, organizada e transparente para terapeutas e pessoas. Se tiver qualquer dúvida durante o processo, nossa equipe estará à disposição para ajudar. Agradecemos pela sua colaboração.",
          ),
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
      text: "Seu perfil foi aprovado.\n\nOlá, {{recipient_name}}.\n\nTemos uma ótima notícia: seu perfil foi aprovado e agora faz parte da comunidade de terapeutas do TES.\n\nA partir deste momento, você já pode acessar sua área na plataforma, concluir as configurações que desejar e preparar seu perfil para começar a receber agendamentos.\n\nLembre-se de manter suas informações sempre atualizadas, organizar sua disponibilidade e apresentar sua prática da forma que melhor representa o seu trabalho.\n\nEstamos felizes por ter você conosco e desejamos que esta seja uma jornada de boas conexões, crescimento e muitas oportunidades para compartilhar o seu conhecimento. Conte conosco sempre que precisar.\n\nEquipe TES\n\nAcessar meu painel: {{dashboard_url}}",
      html: defaultEmailHtml({
        title: "Seu perfil foi aprovado.",
        ctaLabel: "Acessar meu painel",
        ctaUrlToken: "dashboard_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Temos uma ótima notícia: seu perfil foi aprovado e agora faz parte da comunidade de terapeutas do TES.",
          ),
          accountParagraph(
            "A partir deste momento, você já pode acessar sua área na plataforma, concluir as configurações que desejar e preparar seu perfil para começar a receber agendamentos.",
          ),
          accountParagraph(
            "Lembre-se de manter suas informações sempre atualizadas, organizar sua disponibilidade e apresentar sua prática da forma que melhor representa o seu trabalho.",
          ),
          accountParagraph(
            "Estamos felizes por ter você conosco e desejamos que esta seja uma jornada de boas conexões, crescimento e muitas oportunidades para compartilhar o seu conhecimento. Conte conosco sempre que precisar.",
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
      text: "A análise do seu perfil foi concluída.\n\nOlá, {{recipient_name}}.\n\nConcluímos a análise do seu cadastro profissional no TES. Neste momento, infelizmente, não foi possível aprovar o seu perfil para integrar a plataforma.\n\nEssa decisão foi tomada com base nos critérios e políticas adotados pelo TES para manter um ambiente seguro, transparente e alinhado aos princípios da nossa comunidade.\n\nCaso seja possível realizar uma nova solicitação ou complementar informações, as orientações estarão disponíveis na sua área da plataforma.\n\nAgradecemos pelo interesse em fazer parte do TES e pelo tempo dedicado ao processo de cadastro. Desejamos sucesso na continuidade da sua jornada profissional.\n\nEquipe TES\n\nConsultar orientações: {{profile_url}}",
      html: defaultEmailHtml({
        title: "A análise do seu perfil foi concluída.",
        ctaLabel: "Consultar orientações",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Concluímos a análise do seu cadastro profissional no TES."),
          accountParagraph(
            "Neste momento, infelizmente, não foi possível aprovar o seu perfil para integrar a plataforma. Essa decisão foi tomada com base nos critérios e políticas adotados pelo TES para manter um ambiente seguro, transparente e alinhado aos princípios da nossa comunidade.",
          ),
          accountParagraph(
            "Caso seja possível realizar uma nova solicitação ou complementar informações, as orientações estarão disponíveis na sua área da plataforma.",
          ),
          accountParagraph(
            "Agradecemos pelo interesse em fazer parte do TES e pelo tempo dedicado ao processo de cadastro. Desejamos sucesso na continuidade da sua jornada profissional.",
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
      text: "Seu perfil foi suspenso temporariamente.\n\nOlá, {{recipient_name}}.\n\nInformamos que seu perfil no TES foi suspenso temporariamente. Durante esse período, algumas funcionalidades da plataforma poderão ficar indisponíveis, incluindo o recebimento de novos agendamentos e outras atividades relacionadas ao seu perfil profissional.\n\nA suspensão foi aplicada conforme os procedimentos e políticas do TES e será analisada pela equipe responsável. Caso exista alguma ação necessária de sua parte ou possibilidade de regularização, todas as orientações estarão disponíveis na sua área da plataforma.\n\nNosso compromisso é conduzir esse processo com transparência, imparcialidade e respeito a todos os envolvidos. Se precisar de esclarecimentos, nossa equipe estará à disposição para ajudar.\n\nEquipe TES\n\nConsultar minha situação: {{profile_url}}",
      html: defaultEmailHtml({
        title: "Seu perfil foi suspenso temporariamente.",
        ctaLabel: "Consultar minha situação",
        ctaUrlToken: "profile_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Informamos que seu perfil no TES foi suspenso temporariamente."),
          accountParagraph(
            "Durante esse período, algumas funcionalidades da plataforma poderão ficar indisponíveis, incluindo o recebimento de novos agendamentos e outras atividades relacionadas ao seu perfil profissional.",
          ),
          accountParagraph(
            "A suspensão foi aplicada conforme os procedimentos e políticas do TES e será analisada pela equipe responsável. Caso exista alguma ação necessária de sua parte ou possibilidade de regularização, todas as orientações estarão disponíveis na sua área da plataforma.",
          ),
          accountParagraph(
            "Nosso compromisso é conduzir esse processo com transparência, imparcialidade e respeito a todos os envolvidos. Se precisar de esclarecimentos, nossa equipe estará à disposição para ajudar.",
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
      text: "Seu perfil está ativo novamente.\n\nOlá, {{recipient_name}}.\n\nTemos uma boa notícia. Seu perfil foi reativado e já está disponível novamente na plataforma.\n\nA partir deste momento, você volta a ter acesso aos recursos previstos para sua conta e poderá retomar normalmente suas atividades no TES, de acordo com o seu plano e as funcionalidades disponíveis.\n\nCaso tenha atualizado informações durante o período de suspensão, recomendamos revisar seu perfil, sua agenda e suas configurações para garantir que tudo esteja conforme desejado.\n\nEstamos felizes em ter você de volta e seguimos à disposição para apoiar sua jornada sempre que necessário.\n\nEquipe TES\n\nAcessar meu painel: {{dashboard_url}}",
      html: defaultEmailHtml({
        title: "Seu perfil está ativo novamente.",
        ctaLabel: "Acessar meu painel",
        ctaUrlToken: "dashboard_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Temos uma boa notícia. Seu perfil foi reativado e já está disponível novamente na plataforma.",
          ),
          accountParagraph(
            "A partir deste momento, você volta a ter acesso aos recursos previstos para sua conta e poderá retomar normalmente suas atividades no TES, de acordo com o seu plano e as funcionalidades disponíveis.",
          ),
          accountParagraph(
            "Caso tenha atualizado informações durante o período de suspensão, recomendamos revisar seu perfil, sua agenda e suas configurações para garantir que tudo esteja conforme desejado.",
          ),
          accountParagraph(
            "Estamos felizes em ter você de volta e seguimos à disposição para apoiar sua jornada sempre que necessário.",
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
      text: "Seu encontro foi confirmado.\n\nOlá, {{recipient_name}}.\n\nSeu encontro com {{counterparty_name}} está confirmado. A reserva foi concluída e o horário ficou reservado para você.\n\nInformações do encontro:\nTerapeuta: {{counterparty_name}}\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\nModalidade: Online\n\nVocê poderá acompanhar todas as informações e entrar no encontro pela sua área no TES, no momento apropriado.\n\nEquipe TES\n\nVer encontro: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Seu encontro foi confirmado",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu encontro com {{counterparty_name}} está confirmado. A reserva foi concluída e o horário ficou reservado para você.",
          ),
          accountParagraph("<strong>Informações do encontro:</strong>"),
          emailDetailList([
            ["Terapeuta", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Você poderá acompanhar todas as informações e entrar no encontro pela sua área no TES, no momento apropriado.",
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
      subject: "Confirmação da sua sessão no TES",
      preheader: "Está tudo certo. Confira as informações do seu agendamento.",
      text: "Sua sessão foi confirmada.\n\nOlá, {{recipient_name}}.\n\nSua sessão com {{counterparty_name}} está confirmada. A reserva foi concluída e o horário ficou reservado na sua agenda.\n\nInformações da sessão:\nPessoa: {{counterparty_name}}\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\nModalidade: Online\n\nVocê poderá acompanhar todas as informações pela sua área no TES.\n\nEquipe TES\n\nVer sessão: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Sua sessão foi confirmada",
        ctaLabel: "Ver sessão",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Sua sessão com {{counterparty_name}} está confirmada. A reserva foi concluída e o horário ficou reservado na sua agenda.",
          ),
          accountParagraph("<strong>Informações da sessão:</strong>"),
          emailDetailList([
            ["Pessoa", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Você poderá acompanhar todas as informações pela sua área no TES.",
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
  booking_reminder_24h_patient: {
    actionKey: "booking_reminder_24h_patient",
    category: "Encontros",
    label: "Lembrete de encontro — 24 horas — pessoa",
    description: "Lembra a pessoa sobre um encontro confirmado 24 horas antes do horário persistido.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Falta 1 dia para seu encontro no TES",
      preheader: "Seu encontro está se aproximando. Confira os detalhes.",
      text: "Falta 1 dia para seu encontro no TES.\n\nOlá, {{recipient_name}}.\n\nSeu encontro com {{counterparty_name}} está previsto para {{meeting_date_time}} ({{meeting_timezone}}).\n\nTerapeuta: {{counterparty_name}}\nTerapia: {{service_title}}\nModalidade: Online\n\nConfira as informações do encontro pela sua área no TES.\n\nEquipe TES\n\nVer encontro: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Falta 1 dia para seu encontro",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu encontro com {{counterparty_name}} está previsto para amanhã, no horário abaixo.",
          ),
          emailDetailList([
            ["Terapeuta", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Confira as informações do encontro pela sua área no TES.",
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
  booking_reminder_1h_patient: {
    actionKey: "booking_reminder_1h_patient",
    category: "Encontros",
    label: "Lembrete de encontro — 1 hora — pessoa",
    description: "Lembra a pessoa sobre um encontro confirmado 1 hora antes do horário persistido.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu encontro começa em 1 hora",
      preheader: "Está quase na hora. Confira os detalhes do seu encontro.",
      text: "Seu encontro começa em 1 hora.\n\nOlá, {{recipient_name}}.\n\nSeu encontro com {{counterparty_name}} está previsto para {{meeting_date_time}} ({{meeting_timezone}}).\n\nTerapeuta: {{counterparty_name}}\nTerapia: {{service_title}}\nModalidade: Online\n\nAcesse os detalhes pela sua área no TES e entre no encontro no momento apropriado.\n\nEquipe TES\n\nVer encontro: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Seu encontro começa em 1 hora",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Seu encontro com {{counterparty_name}} está previsto para começar em 1 hora.",
          ),
          emailDetailList([
            ["Terapeuta", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Acesse os detalhes pela sua área no TES e entre no encontro no momento apropriado.",
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
      text: "Seu encontro foi cancelado.\n\nOlá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi cancelado. Entendemos que mudanças podem acontecer e deixamos abaixo as informações atualizadas.\n\nTerapeuta: {{counterparty_name}}\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nCaso você queira, poderá encontrar outro horário ou profissional pela sua área no TES.\n\nEquipe TES\n\nVer meus encontros: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Seu encontro foi cancelado",
        ctaLabel: "Ver meus encontros",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "O encontro com {{counterparty_name}} foi cancelado. Entendemos que mudanças podem acontecer e deixamos abaixo as informações atualizadas.",
          ),
          emailDetailList([
            ["Terapeuta", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
          ]),
          accountParagraph(
            "Caso você queira, poderá encontrar outro horário ou profissional pela sua área no TES.",
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
      text: "Sua sessão foi cancelada.\n\nOlá, {{recipient_name}}.\n\nA sessão com {{counterparty_name}} foi cancelada. As informações da agenda foram atualizadas.\n\nPessoa: {{counterparty_name}}\nTerapia: {{service_title}}\nData e horário: {{meeting_date_time}} ({{meeting_timezone}})\n\nVocê pode acompanhar sua agenda e as próximas sessões na sua área do TES.\n\nEquipe TES\n\nVer sessões: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Sua sessão foi cancelada",
        ctaLabel: "Ver sessões",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "A sessão com {{counterparty_name}} foi cancelada. As informações da agenda foram atualizadas.",
          ),
          emailDetailList([
            ["Pessoa", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
          ]),
          accountParagraph(
            "Você pode acompanhar sua agenda e as próximas sessões na sua área do TES.",
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
      text: "Seu encontro foi reagendado.\n\nOlá, {{recipient_name}}.\n\nO encontro com {{counterparty_name}} foi reagendado. A nova data e horário já estão atualizados na sua área do TES.\n\nTerapeuta: {{counterparty_name}}\nTerapia: {{service_title}}\nNova data e horário: {{meeting_date_time}} ({{meeting_timezone}})\nModalidade: Online\n\nSe precisar revisar as informações, acesse seus encontros pela plataforma.\n\nEquipe TES\n\nVer encontro: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Seu encontro foi reagendado",
        ctaLabel: "Ver encontro",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "O encontro com {{counterparty_name}} foi reagendado. A nova data e horário já estão atualizados na sua área do TES.",
          ),
          emailDetailList([
            ["Terapeuta", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Nova data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Se precisar revisar as informações, acesse seus encontros pela plataforma.",
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
      text: "Sua sessão foi reagendada.\n\nOlá, {{recipient_name}}.\n\nA sessão com {{counterparty_name}} foi reagendada. A nova data e horário já estão atualizados na sua agenda.\n\nPessoa: {{counterparty_name}}\nTerapia: {{service_title}}\nNova data e horário: {{meeting_date_time}} ({{meeting_timezone}})\nModalidade: Online\n\nVocê pode acompanhar os detalhes da sessão na sua área do TES.\n\nEquipe TES\n\nVer sessão: {{encounter_url}}",
      html: defaultEmailHtml({
        title: "Sua sessão foi reagendada",
        ctaLabel: "Ver sessão",
        ctaUrlToken: "encounter_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "A sessão com {{counterparty_name}} foi reagendada. A nova data e horário já estão atualizados na sua agenda.",
          ),
          emailDetailList([
            ["Pessoa", "{{counterparty_name}}"],
            ["Terapia", "{{service_title}}"],
            ["Nova data e horário", "{{meeting_date_time}} ({{meeting_timezone}})"],
            ["Modalidade", "Online"],
          ]),
          accountParagraph(
            "Você pode acompanhar os detalhes da sessão na sua área do TES.",
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
      text: "Pagamento confirmado.\n\nOlá, {{recipient_name}}.\n\nRecebemos a confirmação do pagamento realizado no TES. Sua transação foi processada com sucesso e o serviço correspondente já está disponível conforme as regras da plataforma.\n\nResumo da transação:\nValor: {{amount}}\nReferência: {{service_title}}\n\nSe o pagamento estiver relacionado a um encontro, seu agendamento permanece confirmado e você poderá acompanhar todas as informações pela sua área na plataforma.\n\nAgradecemos pela confiança.\n\nEquipe TES\n\nVer detalhes: {{payment_url}}",
      html: defaultEmailHtml({
        title: "Pagamento confirmado com sucesso",
        ctaLabel: "Ver detalhes",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos a confirmação do pagamento realizado no TES. Sua transação foi processada com sucesso e o serviço correspondente já está disponível conforme as regras da plataforma.",
          ),
          accountParagraph("<strong>Resumo da transação:</strong>"),
          emailDetailList([
            ["Valor", "{{amount}}"],
            ["Referência", "{{service_title}}"],
          ]),
          accountParagraph(
            "Se o pagamento estiver relacionado a um encontro, seu agendamento permanece confirmado e você poderá acompanhar todas as informações pela sua área na plataforma.",
          ),
          accountParagraph("Agradecemos pela confiança."),
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
      text: "Não foi possível processar seu pagamento.\n\nOlá, {{recipient_name}}.\n\nTentamos processar o pagamento relacionado à sua solicitação no TES, mas a transação não foi aprovada.\n\nIsso pode ocorrer por diferentes motivos relacionados ao meio de pagamento utilizado.\n\nCaso ainda deseje concluir a operação, você poderá acessar sua conta e realizar uma nova tentativa utilizando o mesmo meio de pagamento ou outro disponível na plataforma.\n\nEnquanto o pagamento não for confirmado, o serviço correspondente permanecerá pendente, conforme as regras do TES.\n\nSe precisar de ajuda, nossa equipe estará à disposição.\n\nEquipe TES\n\nTentar novamente: {{payment_url}}",
      html: defaultEmailHtml({
        title: "Não foi possível concluir seu pagamento",
        ctaLabel: "Tentar novamente",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Tentamos processar o pagamento relacionado à sua solicitação no TES, mas a transação não foi aprovada.",
          ),
          accountParagraph(
            "Isso pode ocorrer por diferentes motivos relacionados ao meio de pagamento utilizado.",
          ),
          accountParagraph(
            "Caso ainda deseje concluir a operação, você poderá acessar sua conta e realizar uma nova tentativa utilizando o mesmo meio de pagamento ou outro disponível na plataforma.",
          ),
          accountParagraph(
            "Enquanto o pagamento não for confirmado, o serviço correspondente permanecerá pendente, conforme as regras do TES. Se precisar de ajuda, nossa equipe estará à disposição.",
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
      text: "Estamos aguardando a confirmação do seu pagamento.\n\nOlá, {{recipient_name}}.\n\nRecebemos sua solicitação de pagamento no TES e ela está sendo processada.\n\nNeste momento, a confirmação da transação ainda depende do processamento pelo meio de pagamento utilizado. Assim que a confirmação for recebida, você será informado automaticamente.\n\nResumo da transação:\nValor: {{amount}}\nReferência: {{service_title}}\n\nEnquanto o pagamento permanecer pendente, o serviço relacionado poderá aguardar a confirmação da transação, conforme as regras da plataforma.\n\nNão é necessário realizar uma nova tentativa neste momento, salvo se houver orientação diferente em sua área no TES.\n\nAgradecemos pela sua compreensão.\n\nEquipe TES\n\nAcompanhar pagamento: {{payment_url}}",
      html: defaultEmailHtml({
        title: "Seu pagamento está em processamento",
        ctaLabel: "Acompanhar pagamento",
        ctaUrlToken: "payment_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos sua solicitação de pagamento no TES e ela está sendo processada.",
          ),
          accountParagraph(
            "Neste momento, a confirmação da transação ainda depende do processamento pelo meio de pagamento utilizado. Assim que a confirmação for recebida, você será informado automaticamente.",
          ),
          accountParagraph("<strong>Resumo da transação:</strong>"),
          emailDetailList([
            ["Valor", "{{amount}}"],
            ["Referência", "{{service_title}}"],
          ]),
          accountParagraph(
            "Enquanto o pagamento permanecer pendente, o serviço relacionado poderá aguardar a confirmação da transação, conforme as regras da plataforma.",
          ),
          accountParagraph(
            "Não é necessário realizar uma nova tentativa neste momento, salvo se houver orientação diferente em sua área no TES. Agradecemos pela sua compreensão.",
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
      text: "Seu reembolso foi aprovado.\n\nOlá, {{recipient_name}}.\n\nSua solicitação de reembolso foi analisada e aprovada.\n\nO processo de devolução do valor já foi iniciado e seguirá os procedimentos do meio de pagamento utilizado na transação.\n\nResumo da solicitação:\nValor do reembolso: {{amount}}\n\nO prazo para que o valor seja disponibilizado pode variar de acordo com a forma de pagamento utilizada e com os procedimentos da instituição financeira responsável.\n\nAssim que o processo for concluído, não será necessária nenhuma ação adicional da sua parte.\n\nSe precisar de ajuda, nossa equipe estará à disposição.\n\nEquipe TES\n\nVer detalhes: {{refund_url}}",
      html: defaultEmailHtml({
        title: "Seu reembolso foi aprovado",
        ctaLabel: "Ver detalhes",
        ctaUrlToken: "refund_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Sua solicitação de reembolso foi analisada e aprovada.",
          ),
          accountParagraph(
            "O processo de devolução do valor já foi iniciado e seguirá os procedimentos do meio de pagamento utilizado na transação.",
          ),
          accountParagraph("<strong>Resumo da solicitação:</strong>"),
          emailDetailList([["Valor do reembolso", "{{amount}}"]]),
          accountParagraph(
            "O prazo para que o valor seja disponibilizado pode variar de acordo com a forma de pagamento utilizada e com os procedimentos da instituição financeira responsável.",
          ),
          accountParagraph(
            "Assim que o processo for concluído, não será necessária nenhuma ação adicional da sua parte. Se precisar de ajuda, nossa equipe estará à disposição.",
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
    description: "Confirma um repasse bancário após payout.paid autoritativo.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu repasse bancário foi confirmado",
      preheader:
        "O valor referente aos seus atendimentos já foi processado.",
      text: "Seu repasse bancário foi confirmado.\n\nOlá, {{recipient_name}}.\n\nA Stripe confirmou o envio de {{amount}} para sua conta de recebimento. A instituição financeira ainda pode devolver uma falha posterior; se isso ocorrer, avisaremos você.\n\nVer painel financeiro: {{finance_url}}",
      html: defaultEmailHtml({
        title: "Seu repasse bancário foi confirmado",
        ctaLabel: "Ver painel financeiro",
        ctaUrlToken: "finance_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "A Stripe confirmou o envio do repasse financeiro referente aos seus atendimentos elegíveis.",
          ),
          accountParagraph("<strong>Resumo da operação:</strong>"),
          emailDetailList([["Valor do repasse", "{{amount}}"]]),
          accountParagraph(
            "A instituição financeira ainda pode devolver uma falha posterior. Se isso ocorrer, avisaremos você.",
          ),
          accountParagraph(
            "Você pode acompanhar o histórico completo dos seus repasses e demais movimentações financeiras diretamente no seu painel do TES.",
          ),
          accountParagraph("Agradecemos por fazer parte da nossa comunidade."),
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
  therapist_payout_failed_after_paid: {
    actionKey: "therapist_payout_failed_after_paid",
    category: "Financeiro",
    label: "Falha posterior no repasse",
    description: "Informa uma falha bancária posterior a payout.paid.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Seu repasse bancário precisa de atenção",
      preheader: "A instituição financeira devolveu uma falha após a confirmação anterior.",
      text: "Olá, {{recipient_name}}.\n\nA instituição financeira informou uma falha posterior no repasse de {{amount}}. Nenhuma nova movimentação será criada automaticamente até a revisão segura da conta.\n\nAcompanhar financeiro: {{finance_url}}",
      html: defaultEmailHtml({
        title: "Seu repasse bancário precisa de atenção",
        ctaLabel: "Acompanhar financeiro",
        ctaUrlToken: "finance_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("A instituição financeira informou uma falha posterior no repasse de {{amount}}."),
          accountParagraph("Nenhuma nova movimentação será criada automaticamente até a revisão segura da conta."),
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
  payout_operational_alert_admin: {
    actionKey: "payout_operational_alert_admin",
    category: "Financeiro",
    label: "Alerta operacional de repasse",
    description: "Notifica administradores sem expor payloads ou dados bancários.",
    supportsAutomaticDispatch: true,
    adminConfigurable: true,
    currentTemplateVersion: "v1",
    defaults: {
      subject: "Repasse exige revisão administrativa",
      preheader: "Uma ocorrência financeira sanitizada foi registrada.",
      text: "Olá, {{recipient_name}}.\n\nUma ocorrência de repasse do tipo {{incident_type}} exige revisão. Consulte a área administrativa para verificar o estado persistido e o runbook.\n\nAbrir pagamentos: {{admin_url}}",
      html: defaultEmailHtml({
        title: "Repasse exige revisão administrativa",
        ctaLabel: "Abrir pagamentos",
        ctaUrlToken: "admin_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph("Uma ocorrência de repasse do tipo {{incident_type}} exige revisão."),
          accountParagraph("Consulte o estado persistido e siga o runbook de reconciliação antes de autorizar nova movimentação."),
        ].join(""),
      }),
    },
    allowedTokens: payoutIncidentTokens,
    previewFixture: {
      recipient_name: "Administrador de exemplo",
      incident_type: "reconciliação necessária",
      admin_url: "https://example.test/admin/pagamentos",
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
      html: defaultEmailHtml({
        title: "Recebemos sua sugestão",
        ctaLabel: "Acompanhar solicitação",
        ctaUrlToken: "request_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Recebemos sua sugestão de terapia <strong>{{request_name}}</strong>. Nossa equipe irá acompanhar a solicitação.",
          ),
        ].join(""),
      }),
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
      html: defaultEmailHtml({
        title: "Sua solicitação foi atualizada",
        ctaLabel: "Ver atualização",
        ctaUrlToken: "request_url",
        body: [
          accountParagraph("Olá, {{recipient_name}}."),
          accountParagraph(
            "Sua solicitação <strong>{{request_name}}</strong> foi atualizada para {{request_status}}.",
          ),
          accountParagraph("{{decision_message}}"),
        ].join(""),
      }),
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
