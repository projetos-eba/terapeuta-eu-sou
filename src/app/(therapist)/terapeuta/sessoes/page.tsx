import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistSessionsPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.sessions}
      title="Sessões"
    />
  );
}
