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

const tones: Record<TherapistServiceStatus, "brand" | "soft" | "success"> = {
  active: "success",
  archived: "soft",
  draft: "soft",
  paused: "soft",
  rejected: "soft",
  requires_review: "brand",
};

export function TherapistServiceStatusBadge({
  status,
}: {
  status: TherapistServiceStatus;
}) {
  return (
    <TESBadge tone={tones[status]}>
      <span className="sr-only">Estado do serviço: </span>
      {labels[status]}
    </TESBadge>
  );
}

export function getTherapistServiceStatusLabel(status: TherapistServiceStatus) {
  return labels[status];
}
