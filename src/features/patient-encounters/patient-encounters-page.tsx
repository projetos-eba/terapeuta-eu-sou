import { AppPageContainer } from "@/components/app-page";

import { EncounterHistorySection } from "./components/encounter-history-section";
import { NextEncounterSpotlight } from "./components/next-encounter-spotlight";
import { PatientEncountersHero } from "./components/patient-encounters-hero";
import { PendingSessionFeedbackSection } from "./components/pending-session-feedback-section";
import { UpcomingEncountersSection } from "./components/upcoming-encounters-section";
import type { PatientEncountersPageData } from "./patient-encounters.types";

export function PatientEncountersPage({
  data,
  initialFeedbackBookingId,
}: {
  data: PatientEncountersPageData;
  initialFeedbackBookingId?: string | null;
}) {
  const followingEncounters = data.upcomingEncounters.slice(1);

  return (
    <AppPageContainer className="max-w-[1080px] gap-9 pb-12 sm:gap-11">
      <PatientEncountersHero />
      <NextEncounterSpotlight encounter={data.nextEncounter} />
      <PendingSessionFeedbackSection
        initialBookingId={initialFeedbackBookingId}
        sessions={data.pendingFeedbackSessions}
      />

      {followingEncounters.length > 0 ? (
        <UpcomingEncountersSection encounters={followingEncounters} />
      ) : null}

      <EncounterHistorySection
        encounters={data.historyEncounters}
        pagination={data.historyPagination}
      />
    </AppPageContainer>
  );
}
