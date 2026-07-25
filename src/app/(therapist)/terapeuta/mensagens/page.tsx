import {
  TherapistFeaturePage,
  therapistRoutePolicies,
} from "@/features/therapist-shell";

export default function TherapistMessagesPage() {
  return (
    <TherapistFeaturePage
      policy={therapistRoutePolicies.messages}
      title="Mensagens"
    />
  );
}
