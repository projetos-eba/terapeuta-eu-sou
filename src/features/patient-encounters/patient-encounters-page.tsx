import { NewPathsBanner } from "./components/new-paths-banner";
import { PatientEncountersHero } from "./components/patient-encounters-hero";
import { PatientEncountersMetrics } from "./components/patient-encounters-metrics";
import { RecentJourneyCard } from "./components/recent-journey-card";
import { EncounterHistorySection } from "./components/encounter-history-section";
import { UpcomingEncountersSection } from "./components/upcoming-encounters-section";
import type { PatientEncountersPageData } from "./patient-encounters.types";

export function PatientEncountersPage({
  data,
}: {
  data: PatientEncountersPageData;
}) {
  return (
    <main className="space-y-6 pb-10 text-tesText-primary">
      <PatientEncountersHero patient={data.patient} />
      <PatientEncountersMetrics
        favoriteTherapistsCount={data.metrics.favoriteTherapistsCount}
        nextEncounter={data.nextEncounter}
        activeCount={data.metrics.activeCount}
        completedCount={data.metrics.completedCount}
      />
      <UpcomingEncountersSection encounters={data.upcomingEncounters} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <EncounterHistorySection encounters={data.historyEncounters} />
        <div className="grid gap-6">
          <RecentJourneyCard topics={data.recentJourneyTopics} />
          <NewPathsBanner />
        </div>
      </div>
    </main>
  );
}
