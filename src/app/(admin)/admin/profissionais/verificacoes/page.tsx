import { AdminOperationRoute } from "../../operation-route";

export default async function AdminVerificationsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute
      module="verifications"
      searchParams={await searchParams}
    />
  );
}
