import type {
  MessageCenterActorRole,
  MessageCenterTemplate,
} from "./message-center.types";

const therapistToPatient: MessageCenterTemplate[] = [
  {
    body: "Confirmo que nossa sessão está mantida no horário agendado.",
    category: "confirmacao",
    description:
      "Confirma ao paciente que a sessão permanece no horário combinado.",
    key: "therapist_confirm_session",
    label: "Confirmar sessão",
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Enviei uma orientação geral para apoiar sua preparação antes do encontro.",
    category: "acompanhamento",
    description:
      "Lembra o paciente de consultar as orientações antes do encontro.",
    key: "therapist_send_preparation",
    label: "Orientação pré-sessão",
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Recebi sua solicitação de reagendamento e vou avaliar a agenda pelo fluxo seguro da plataforma.",
    category: "reagendamento",
    description: "Confirma que a solicitação de reagendamento foi recebida.",
    key: "therapist_ack_reschedule",
    label: "Receber reagendamento",
    requiresBooking: true,
    ctaAction: "reschedule_session",
  },
  {
    body: "Estou disponível na sala e você já pode entrar no encontro.",
    category: "atendimento",
    description:
      "Use quando você já estiver disponível para iniciar o encontro online.",
    key: "therapist_available_in_room",
    label: "Disponível na sala",
    requiresBooking: true,
    ctaAction: "open_session",
  },
  {
    body: "Tive um pequeno atraso. Devo conseguir estar com você {{delay_window_label}}.",
    category: "atualizacao",
    description: "Comunica uma janela curta de atraso.",
    key: "therapist_delay",
    label: "Pequeno atraso",
    parameters: [
      {
        key: "delay_window",
        label: "Janela do atraso",
        options: [
          { value: "up_to_5_minutes", label: "em até 5 minutos" },
          { value: "up_to_10_minutes", label: "em até 10 minutos" },
          {
            value: "technical_difficulty",
            label: "assim que resolver uma dificuldade técnica",
          },
        ],
      },
    ],
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Estou enfrentando uma dificuldade técnica. Por favor, aguarde enquanto restabeleço o acesso à sessão.",
    category: "atendimento",
    description:
      "Avisa que uma dificuldade técnica está impedindo o início normal.",
    key: "therapist_technical_difficulty",
    label: "Dificuldade técnica",
    requiresBooking: true,
    ctaAction: "view_session",
  },
];

const legacyParticipantTemplates: MessageCenterTemplate[] = [
  {
    body: "O cancelamento desta sessão foi processado pelo fluxo da plataforma.",
    category: "atualizacao",
    description: "Modelo histórico, indisponível para novos envios.",
    key: "therapist_cancel_processed",
    label: "Cancelamento processado",
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Para continuar, use o fluxo seguro da plataforma nesta sessão.",
    category: "plataforma",
    description: "Modelo histórico, indisponível para novos envios.",
    key: "therapist_platform_action",
    label: "Ação na plataforma",
    requiresBooking: true,
    ctaAction: "view_session",
  },
];

const patientToTherapist: MessageCenterTemplate[] = [
  {
    body: "Confirmo que estarei presente na sessão agendada.",
    category: "confirmacao",
    description: "Confirma ao terapeuta que você participará da sessão.",
    key: "patient_confirm_session",
    label: "Confirmar presença",
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Tenho uma dúvida sobre informações práticas da sessão.",
    category: "duvida",
    description:
      "Sinaliza uma dúvida operacional sem escrever uma mensagem livre.",
    key: "patient_practical_question",
    label: "Dúvida prática",
    requiresBooking: true,
    ctaAction: "view_session",
  },
  {
    body: "Preciso solicitar um novo horário pelo fluxo de reagendamento da plataforma.",
    category: "reagendamento",
    description:
      "Indica que você precisa conversar sobre outro horário pelo fluxo seguro.",
    key: "patient_request_reschedule",
    label: "Sinalizar reagendamento",
    requiresBooking: true,
    ctaAction: "reschedule_session",
  },
  {
    body: "Estou com dificuldade para entrar no encontro.",
    category: "atendimento",
    description:
      "Sinaliza que o acesso ao encontro não está funcionando como esperado.",
    key: "patient_technical_difficulty",
    label: "Dificuldade para entrar",
    requiresBooking: true,
    ctaAction: "open_session",
  },
  {
    body: "Preciso de orientação para cancelar este encontro. Vou usar o fluxo da plataforma.",
    category: "atualizacao",
    description:
      "Indica que você precisa de orientação sem cancelar fora do fluxo seguro.",
    key: "patient_cancel_guidance",
    label: "Orientação para cancelamento",
    requiresBooking: true,
    ctaAction: "cancel_session",
  },
];

for (const template of [...therapistToPatient, ...patientToTherapist]) {
  template.parameters ??= [];
}

const patientSupport: MessageCenterTemplate[] = [
  {
    body: "Preciso de ajuda com pagamento, reembolso ou comprovante.",
    category: "financeiro",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "patient_support_payment",
    label: "Pagamento ou reembolso",
    parameters: [],
  },
  {
    body: "Preciso de ajuda para acessar minha sessão online.",
    category: "atendimento",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "patient_support_access",
    label: "Acesso à sessão",
    parameters: [],
  },
  {
    body: "Quero falar com a plataforma sobre uma situação da minha conta.",
    category: "suporte",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "patient_support_account",
    label: "Conta e suporte",
    parameters: [],
  },
];

const therapistSupport: MessageCenterTemplate[] = [
  {
    body: "Preciso de apoio sobre repasse, financeiro ou assinatura.",
    category: "financeiro",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "therapist_support_finance",
    label: "Financeiro",
    parameters: [],
  },
  {
    body: "Preciso de ajuda com agenda, bloqueios ou reagendamento.",
    category: "atendimento",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "therapist_support_schedule",
    label: "Agenda e sessões",
    parameters: [],
  },
  {
    body: "Quero falar com a plataforma sobre perfil, serviços ou conta.",
    category: "suporte",
    description:
      "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
    key: "therapist_support_account",
    label: "Conta profissional",
    parameters: [],
  },
];

export function getParticipantTemplates(actorRole: MessageCenterActorRole) {
  return actorRole === "therapist" ? therapistToPatient : patientToTherapist;
}

export function getSupportTemplates(actorRole: MessageCenterActorRole) {
  return actorRole === "therapist" ? therapistSupport : patientSupport;
}

export function getTemplateByKey(key: string) {
  return [
    ...therapistToPatient,
    ...patientToTherapist,
    ...legacyParticipantTemplates,
  ].find((template) => template.key === key);
}

export function isSelectableParticipantTemplate(key: string) {
  return getParticipantTemplates("therapist")
    .concat(getParticipantTemplates("patient"))
    .some((template) => template.key === key);
}

export function getSupportTemplateByKey(key: string) {
  return [...patientSupport, ...therapistSupport].find(
    (template) => template.key === key,
  );
}
