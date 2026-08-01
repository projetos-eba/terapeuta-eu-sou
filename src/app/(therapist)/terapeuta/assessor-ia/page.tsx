import {
  therapistRoutePolicies,
} from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import {
  getTherapistAuraPage,
  TherapistAuraErrorState,
  TherapistAuraPage,
} from "@/features/therapist-aura";

export default async function TherapistAssessorIaPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const periodDays = params?.period === "90" ? 90 : 30;
  const session = await requireTherapistSession(
    therapistRoutePolicies.assessorIa,
  );
  const result = await getTherapistAuraPage({
    accessToken: session.accessToken,
    periodDays,
    profileId: session.profileId,
  });

  if (!result.ok) {
    return <TherapistAuraErrorState message={result.message} />;
  }

  return <TherapistAuraPage data={result.data} />;
}
