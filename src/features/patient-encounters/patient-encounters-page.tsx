import { AppPageContainer } from "@/components/app-page";

import { EncounterHistorySection } from "./components/encounter-history-section";
import { NextEncounterSpotlight } from "./components/next-encounter-spotlight";
import { PatientEncountersHero } from "./components/patient-encounters-hero";
import { UpcomingEncountersSection } from "./components/upcoming-encounters-section";
import type { PatientEncountersPageData } from "./patient-encounters.types";

export function PatientEncountersPage({
  data,
}: {
  data: PatientEncountersPageData;
}) {
  const followingEncounters = data.upcomingEncounters.slice(1);

  return (
    <AppPageContainer className="max-w-[1080px] gap-9 pb-12 sm:gap-11">
      <PatientEncountersHero patient={data.patient} />
      <NextEncounterSpotlight encounter={data.nextEncounter} />

      {followingEncounters.length > 0 ? (
        <UpcomingEncountersSection encounters={followingEncounters} />
      ) : null}

      <EncounterHistorySection encounters={data.historyEncounters} />
    </AppPageContainer>
  );
}
