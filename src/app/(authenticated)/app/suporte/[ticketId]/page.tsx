import { SupportTicketPage } from "@/features/support/components/therapist-support-ticket-page";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await requirePatientSession();
  const { ticketId } = await params;
  return <SupportTicketPage actorRole="patient" ticketId={ticketId} />;
}
