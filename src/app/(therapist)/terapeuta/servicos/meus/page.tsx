import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistOwnServicesPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.services}
      title="Meus serviços"
    />
  );
}
