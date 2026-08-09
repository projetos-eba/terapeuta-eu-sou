import { AdminOperationRoute } from "../operation-route";

export default async function AdminPatientsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute module="patients" searchParams={await searchParams} />
  );
}
