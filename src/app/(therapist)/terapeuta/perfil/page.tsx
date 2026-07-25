import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistProfilePage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.profile}
      title="Meu perfil"
    />
  );
}
