import { AdminFinanceDetailRoute } from "../../finance-detail-route";

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;

  return <AdminFinanceDetailRoute id={subscriptionId} module="subscriptions" />;
}
