import type {
  PatientEncounter,
  PatientEncounterStatus,
} from "./patient-encounters.types";

const STATUS_GUIDANCE: Record<PatientEncounterStatus, string> = {
  awaiting_feedback:
    "Conte como foi este encontro. Sua avaliação é privada e separada da avaliação pública do terapeuta.",
  cancelled:
    "Este encontro foi cancelado. Consulte os detalhes da sessão.",
  completed:
    "Este encontro foi realizado. Consulte os detalhes do encontro.",
  not_performed: "Caso precise de ajuda, entre em contato com o suporte.",
  refunded:
    "O pagamento deste encontro foi reembolsado. Consulte os detalhes para acompanhar o registro.",
  confirmed:
    "Seu horário está confirmado. Os detalhes ficam disponíveis quando você precisar.",
  live: "A entrada está disponível agora.",
  payment_incomplete:
    "O pagamento não foi concluído. Você pode tentar novamente, mas o horário só será garantido após a autorização.",
  pending_payment:
    "O pagamento precisa de atenção antes da confirmação do encontro.",
  reschedule_requested: "Há uma solicitação de reagendamento em andamento.",
};

export function getEncounterGuidance(encounter: PatientEncounter) {
  if (encounter.actionHint) return encounter.actionHint;

  return STATUS_GUIDANCE[encounter.status];
}

export function getSpotlightEyebrow(encounter: PatientEncounter | null) {
  if (!encounter) return "Próximo passo";
  if (encounter.status === "live") return "Entrada disponível";
  if (encounter.paymentScheduled) return "Próximo encontro";
  if (
    encounter.status === "pending_payment" ||
    encounter.status === "payment_incomplete"
  )
    return "Atenção necessária";
  if (encounter.status === "reschedule_requested") return "Reagendamento";

  return "Próximo encontro";
}
