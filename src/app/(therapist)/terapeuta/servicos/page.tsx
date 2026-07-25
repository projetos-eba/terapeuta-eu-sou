import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistServicesPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.services}
      title="Suas terapias"
    />
  );
}
