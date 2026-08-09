import { AdminOperationDetailRoute } from "../../operation-detail-route";

export default async function AdminProfessionalDetailRoute({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const { professionalId } = await params;

  return (
    <AdminOperationDetailRoute id={professionalId} module="professionals" />
  );
}
