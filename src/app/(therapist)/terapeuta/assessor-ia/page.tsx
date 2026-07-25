import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistAssessorIaPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.assessorIa}
      title="Aura IA"
    />
  );
}
