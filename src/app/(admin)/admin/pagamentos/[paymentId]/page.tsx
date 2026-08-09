import { AdminFinanceDetailRoute } from "../../finance-detail-route";

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  return <AdminFinanceDetailRoute id={paymentId} module="payments" />;
}
