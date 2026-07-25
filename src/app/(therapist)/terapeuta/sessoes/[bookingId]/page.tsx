import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistSessionDetailPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.sessions}
      title="Detalhe da sessão"
    />
  );
}
