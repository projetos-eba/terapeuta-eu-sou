import { TESBadge } from "@/components/tes";

import type { TherapistServiceStatus } from "../therapist-services.types";

const labels: Record<TherapistServiceStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
  draft: "Rascunho",
  paused: "Pausado",
  rejected: "Rejeitado",
  requires_review: "Em revisão",
};

const toneClasses: Record<TherapistServiceStatus, string> = {
  active: "bg-status-successBg text-status-success",
  archived: "bg-status-dangerBg text-status-danger",
  draft: "bg-brand-lavenderSoft text-brand-primary",
  paused: "bg-status-warningBg text-status-warning",
  rejected: "bg-brand-lavenderSoft text-brand-primary",
  requires_review: "bg-brand-primary text-white",
};

export function TherapistServiceStatusBadge({
  status,
}: {
  status: TherapistServiceStatus;
}) {
  return (
    <TESBadge className={toneClasses[status]}>
      <span className="sr-only">Situação da terapia: </span>
      {labels[status]}
    </TESBadge>
  );
}

export function getTherapistServiceStatusLabel(status: TherapistServiceStatus) {
  return labels[status];
}
