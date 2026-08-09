import { AdminOperationDetailRoute } from "../../operation-detail-route";

export default async function AdminSessionDetailRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <AdminOperationDetailRoute id={sessionId} module="sessions" />;
}
