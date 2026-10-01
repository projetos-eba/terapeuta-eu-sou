import {
  TherapistInterestMetricsPage,
  TherapistMetricsErrorState,
  TherapistMetricsPage,
  TherapistSessionMetricsPage,
} from "@/features/therapist-metrics";
import { getTherapistMetricsView } from "@/features/therapist-metrics/therapist-metrics.service";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

// The tab is selected from searchParams. Rendering this route dynamically
// prevents a cached overview document from being served for ?tab=sessions.
export const dynamic = "force-dynamic";

export default async function TherapistInsightsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodDays =
    params?.period === "60"
      ? 60
      : 30;
  const tab =
    params?.tab === "sessions" || params?.tab === "interest"
      ? params.tab
      : "overview";
  const session = await requireTherapistSession(
    therapistRoutePolicies.insights,
  );
  const result = await getTherapistMetricsView({
    accessToken: session.accessToken,
    periodDays,
    profileId: session.profileId,
    tab,
  });

  if (result.status === "error") {
    return <TherapistMetricsErrorState message={result.message} />;
  }

  if (result.tab === "sessions") {
    return <TherapistSessionMetricsPage data={result.data} />;
  }

  if (result.tab === "interest") {
    return (
      <TherapistInterestMetricsPage
        data={result.data}
        todayActivity={result.todayActivity}
      />
    );
  }

  return <TherapistMetricsPage data={result.data} />;
}
