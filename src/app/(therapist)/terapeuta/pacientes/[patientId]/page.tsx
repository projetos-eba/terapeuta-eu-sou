import {
  JourneyHistoryState,
  TherapistJourneyDetailPage,
  getTherapistJourneyDetail,
} from "@/features/therapist-journey-history";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistPatientJourneyPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.patients,
  );
  const { patientId } = await params;
  const result = await getTherapistJourneyDetail({
    accessToken: session.accessToken,
    patientId,
    therapistProfileId: session.profileId,
  });

  if (result.status !== "success") {
    return (
      <JourneyHistoryState
        message={result.message}
        title={
          result.status === "empty"
            ? "Jornada não encontrada"
            : "Jornada indisponível"
        }
      />
    );
  }

  return <TherapistJourneyDetailPage data={result.data} />;
}
