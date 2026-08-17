import type { SessionPresentation } from "@/features/bookings";

export type SessionTimingBadge = {
  label: string;
  tone: "info" | "success" | "warning";
};

/**
 * Mostra a proximidade da sala somente quando o estado autoritativo da sessão
 * já indica janela de entrada, andamento ou preparação.
 */
export function getSessionTimingBadge(
  presentation: Pick<SessionPresentation, "state">,
): SessionTimingBadge | null {
  if (presentation.state === "ready") {
    return { label: "Pronta para entrar", tone: "success" };
  }

  if (presentation.state === "in_progress") {
    return { label: "Sessão em andamento", tone: "info" };
  }

  if (presentation.state === "room_preparing") {
    return { label: "Sala em preparação", tone: "warning" };
  }

  return null;
}
