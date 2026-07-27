import {
  JourneyHistoryState,
  parseJourneyHistoryFilters,
  TherapistJourneyHistoryPage,
  getTherapistJourneyHistoryPage,
} from "@/features/therapist-journey-history";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistPatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.patients,
  );
  const result = await getTherapistJourneyHistoryPage({
    accessToken: session.accessToken,
    therapistProfileId: session.profileId,
  });

  if (result.status !== "success") {
    return (
      <JourneyHistoryState
        message={result.message}
        title={
          result.status === "empty"
            ? "Histórico em construção"
            : "Histórico indisponível"
        }
      />
    );
  }

  return (
    <TherapistJourneyHistoryPage
      data={result.data}
      filters={parseJourneyHistoryFilters(await searchParams)}
    />
  );
}
