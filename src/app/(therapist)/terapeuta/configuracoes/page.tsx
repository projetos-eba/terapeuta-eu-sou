import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistSettingsPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.settings}
      title="Configurações"
    />
  );
}
