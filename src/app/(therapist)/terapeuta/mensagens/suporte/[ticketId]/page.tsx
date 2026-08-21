import { TherapistSupportTicketPage } from "@/features/support/components/therapist-support-ticket-page";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await requireTherapistSession(therapistRoutePolicies.messages);
  const { ticketId } = await params;
  return <TherapistSupportTicketPage ticketId={ticketId} />;
}
