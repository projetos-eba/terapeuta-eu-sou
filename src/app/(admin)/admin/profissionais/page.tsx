import { AdminOperationRoute } from "../operation-route";

export default async function AdminProfessionalsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute
      module="professionals"
      searchParams={await searchParams}
    />
  );
}
