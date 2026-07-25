import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistSupportPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.support}
      title="Ajuda"
    />
  );
}
