import { AdminFinanceRoute } from "../finance-route";

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminFinanceRoute
      module="subscriptions"
      searchParams={await searchParams}
    />
  );
}
