import { AdminOperationDetailRoute } from "../../../operation-detail-route";

export default async function AdminVerificationDetailRoute({
  params,
}: {
  params: Promise<{ verificationId: string }>;
}) {
  const { verificationId } = await params;

  return (
    <AdminOperationDetailRoute id={verificationId} module="verifications" />
  );
}
