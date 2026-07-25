import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistPatientJourneyPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.patients}
      title="Jornada da pessoa"
    />
  );
}
