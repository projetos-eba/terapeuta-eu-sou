import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistReviewsPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.reviews}
      title="Avaliações"
    />
  );
}
