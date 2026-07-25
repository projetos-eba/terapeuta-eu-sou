import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistInsightsPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.insights}
      title="Métricas & Relatórios"
    />
  );
}
