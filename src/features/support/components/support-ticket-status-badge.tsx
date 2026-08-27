import { TESBadge } from "@/components/tes/tes-badge";

import {
  getSupportTicketStatusPresentation,
  type SupportTicketViewer,
} from "../support-ticket-presentation";

export function SupportTicketStatusBadge({
  status,
  viewer,
}: {
  status: string;
  viewer: SupportTicketViewer;
}) {
  const presentation = getSupportTicketStatusPresentation(status, viewer);
  return <TESBadge tone={presentation.tone}>{presentation.label}</TESBadge>;
}
