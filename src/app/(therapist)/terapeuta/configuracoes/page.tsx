import {
  TherapistSettingsErrorState,
  TherapistSettingsPage as TherapistSettingsContent,
} from "@/features/therapist-settings/components/therapist-settings-page";
import { getTherapistPlanPageData } from "@/features/therapist-plan";
import { getTherapistSettingsPage } from "@/features/therapist-settings/therapist-settings.service";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistSettingsPage() {
  const session = await requireTherapistSession(
    therapistRoutePolicies.settings,
  );
  const pageData = await Promise.all([
    getTherapistSettingsPage({
      accessToken: session.accessToken,
      profileId: session.profileId,
      userId: session.userId,
    }),
    getTherapistPlanPageData({
      accessToken: session.accessToken,
      effectivePlan: session.plan,
      profileId: session.profileId,
    }),
  ]).catch(() => null);

  if (!pageData) {
    return (
      <TherapistSettingsErrorState message="Não foi possível carregar suas configurações e assinatura agora. Tente novamente em instantes." />
    );
  }
  const [result, planData] = pageData;

  if (result.status === "error") {
    return <TherapistSettingsErrorState message={result.message} />;
  }

  return (
    <TherapistSettingsContent planData={planData} settings={result.data} />
  );
}
