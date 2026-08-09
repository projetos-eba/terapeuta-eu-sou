import { AdminOperationRoute } from "../operation-route";

export default async function AdminSupportRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute module="support" searchParams={await searchParams} />
  );
}
