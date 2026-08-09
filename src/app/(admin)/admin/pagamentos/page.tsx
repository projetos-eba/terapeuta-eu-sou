import { AdminFinanceRoute } from "../finance-route";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminFinanceRoute module="payments" searchParams={await searchParams} />
  );
}
