import { AdminOperationRoute } from "../operation-route";

export default async function AdminReviewsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminOperationRoute module="reviews" searchParams={await searchParams} />
  );
}
