import {
  TherapistSettingsErrorState,
  TherapistSettingsPage as TherapistSettingsContent,
} from "@/features/therapist-settings/components/therapist-settings-page";
import { getTherapistSettingsPage } from "@/features/therapist-settings/therapist-settings.service";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistSettingsPage() {
  const session = await requireTherapistSession(therapistRoutePolicies.settings);
  const result = await getTherapistSettingsPage({
    accessToken: session.accessToken,
    profileId: session.profileId,
    userId: session.userId,
  });

  if (result.status === "error") {
    return <TherapistSettingsErrorState message={result.message} />;
  }

  return <TherapistSettingsContent settings={result.data} />;
}
