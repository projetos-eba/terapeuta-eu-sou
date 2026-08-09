import { AdminOperationDetailRoute } from "../../operation-detail-route";

export default async function AdminPatientDetailRoute({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  return <AdminOperationDetailRoute id={patientId} module="patients" />;
}
