import { AdminOperationRoute } from "../operation-route";

export default async function AdminSessionsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute module="sessions" searchParams={await searchParams} />
  );
}
