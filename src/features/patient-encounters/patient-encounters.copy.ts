import type {
  PatientEncounter,
  PatientEncounterStatus,
} from "./patient-encounters.types";

const STATUS_GUIDANCE: Record<PatientEncounterStatus, string> = {
  cancelled:
    "Este encontro foi cancelado. Consulte os detalhes para acompanhar o reembolso, quando aplicável.",
  completed:
    "Este encontro foi realizado. O resumo, a avaliação ou o suporte aparecem conforme o encontro.",
  confirmed:
    "Seu horário está confirmado. Os detalhes ficam disponíveis quando você precisar.",
  live: "A entrada está disponível agora.",
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
  if (encounter.status === "pending_payment") return "Atenção necessária";
  if (encounter.status === "reschedule_requested") return "Reagendamento";

  return "Próximo encontro";
}
