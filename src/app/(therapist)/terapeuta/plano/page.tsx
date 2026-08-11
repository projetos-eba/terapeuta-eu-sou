import {
  getTherapistPlanPageData,
  TherapistPlanErrorState,
  TherapistPlanPage as TherapistPlanContent,
  TherapistPlanQueryError,
} from "@/features/therapist-plan";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistPlanPage() {
  const session = await requireTherapistSession(therapistRoutePolicies.plan);

  try {
    const data = await getTherapistPlanPageData({
      accessToken: session.accessToken,
      effectivePlan: session.plan,
      profileId: session.profileId,
    });
    return <TherapistPlanContent data={data} />;
  } catch (error) {
    if (!(error instanceof TherapistPlanQueryError)) throw error;
    return (
      <TherapistPlanErrorState message="Não foi possível carregar os planos e sua assinatura agora. Tente novamente em instantes." />
    );
  }
}
