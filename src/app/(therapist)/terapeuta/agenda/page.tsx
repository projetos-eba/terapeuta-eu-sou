import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistAgendaPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.agenda}
      title="Agenda"
    />
  );
}
