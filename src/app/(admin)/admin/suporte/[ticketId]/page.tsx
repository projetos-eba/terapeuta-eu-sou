import { AdminOperationDetailRoute } from "../../operation-detail-route";

export default async function AdminSupportTicketDetailRoute({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;

  return <AdminOperationDetailRoute id={ticketId} module="support" />;
}
