import { AdminFinanceRoute } from "../finance-route";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminFinanceRoute module="reports" searchParams={await searchParams} />
  );
}
