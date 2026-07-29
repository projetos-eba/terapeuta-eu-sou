import {
  TherapistReviewsErrorState,
  TherapistReviewsPage,
} from "@/features/therapist-reviews/components/therapist-reviews-page";
import { getTherapistReviewsPage } from "@/features/therapist-reviews/therapist-reviews.service";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistReviewsRoutePage() {
  const session = await requireTherapistSession(therapistRoutePolicies.reviews);
  const result = await getTherapistReviewsPage({
    accessToken: session.accessToken,
    profileId: session.profileId,
  });

  if (result.status === "error") {
    return (
      <TherapistReviewsErrorState
        message={result.message}
        requestId={result.requestId}
      />
    );
  }

  return <TherapistReviewsPage initialData={result.data} />;
}
