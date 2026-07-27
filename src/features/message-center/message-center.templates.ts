import type {
  MessageCenterActorRole,
  MessageCenterTemplate,
} from "./message-center.types";

const therapistToPatient: MessageCenterTemplate[] = [
  {
    body: "Confirmo que nossa sessão está mantida no horário agendado.",
    category: "confirmacao",
    key: "therapist_confirm_session",
    label: "Confirmar sessão",
  },
  {
    body: "Enviei uma orientação geral para apoiar sua preparação antes do encontro.",
    category: "acompanhamento",
    key: "therapist_send_preparation",
    label: "Orientação pré-sessão",
  },
  {
    body: "Recebi sua solicitação de reagendamento e vou avaliar a agenda pelo fluxo seguro da plataforma.",
    category: "reagendamento",
    key: "therapist_ack_reschedule",
    label: "Receber reagendamento",
  },
];

const patientToTherapist: MessageCenterTemplate[] = [
  {
    body: "Confirmo que estarei presente na sessão agendada.",
    category: "confirmacao",
    key: "patient_confirm_session",
    label: "Confirmar presença",
  },
  {
    body: "Tenho uma dúvida sobre informações práticas da sessão.",
    category: "duvida",
    key: "patient_practical_question",
    label: "Dúvida prática",
  },
  {
    body: "Preciso solicitar um novo horário pelo fluxo de reagendamento da plataforma.",
    category: "reagendamento",
    key: "patient_request_reschedule",
    label: "Sinalizar reagendamento",
  },
];

const patientSupport: MessageCenterTemplate[] = [
  {
    body: "Preciso de ajuda com pagamento, reembolso ou comprovante.",
    category: "financeiro",
    key: "patient_support_payment",
    label: "Pagamento ou reembolso",
  },
  {
    body: "Preciso de ajuda para acessar minha sessão online.",
    category: "atendimento",
    key: "patient_support_access",
    label: "Acesso à sessão",
  },
  {
    body: "Quero falar com a plataforma sobre uma situação da minha conta.",
    category: "suporte",
    key: "patient_support_account",
    label: "Conta e suporte",
  },
];

const therapistSupport: MessageCenterTemplate[] = [
  {
    body: "Preciso de apoio sobre repasse, financeiro ou assinatura.",
    category: "financeiro",
    key: "therapist_support_finance",
    label: "Financeiro",
  },
  {
    body: "Preciso de ajuda com agenda, bloqueios ou reagendamento.",
    category: "atendimento",
    key: "therapist_support_schedule",
    label: "Agenda e sessões",
  },
  {
    body: "Quero falar com a plataforma sobre perfil, serviços ou conta.",
    category: "suporte",
    key: "therapist_support_account",
    label: "Conta profissional",
  },
];

export function getParticipantTemplates(actorRole: MessageCenterActorRole) {
  return actorRole === "therapist" ? therapistToPatient : patientToTherapist;
}

export function getSupportTemplates(actorRole: MessageCenterActorRole) {
  return actorRole === "therapist" ? therapistSupport : patientSupport;
}

export function getTemplateByKey(key: string) {
  return [...therapistToPatient, ...patientToTherapist].find(
    (template) => template.key === key,
  );
}
