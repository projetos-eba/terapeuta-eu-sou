import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistFinancePage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.finance}
      title="Financeiro"
    />
  );
}
