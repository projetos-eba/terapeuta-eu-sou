import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistPatientsPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.patients}
      title="Histórico da Jornada"
    />
  );
}
