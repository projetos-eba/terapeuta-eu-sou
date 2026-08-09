import { AdminOperationDetailRoute } from "../../operation-detail-route";

export default async function AdminReviewDetailRoute({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  return <AdminOperationDetailRoute id={reviewId} module="reviews" />;
}
