import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistPlanPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.plan}
      title="Plano e assinatura"
    />
  );
}
