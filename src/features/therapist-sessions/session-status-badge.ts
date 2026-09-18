import type { SessionPresentation } from "@/features/bookings";

export function getTherapistSessionStatusBadge(
  presentation: SessionPresentation,
  actorRealized = false,
  feedbackPending = false,
) {
  if (presentation.state !== "cancelled" && presentation.state !== "refunded") {
    if (actorRealized) {
      return { label: "Realizada", tone: "success" as const };
    }
    if (feedbackPending) {
      return { label: "Avaliação pendente", tone: "warning" as const };
    }
  }

  if (presentation.state === "payment_pending") {
    return { label: "Pag. pendente", tone: presentation.tone };
  }
  if (presentation.state === "reschedule_requested") {
    return { label: "Reagendamento", tone: presentation.tone };
  }
  if (presentation.state === "requires_attention") {
    return { label: "Atenção", tone: presentation.tone };
  }
  if (presentation.state === "room_preparing") {
    return { label: "Sala preparando", tone: presentation.tone };
  }

  return { label: presentation.label, tone: presentation.tone };
}
