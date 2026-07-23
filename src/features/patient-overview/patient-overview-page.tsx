import type { MoodKey, PatientOverview } from "./patient-overview.types";
import { PatientActivitySection } from "./patient-activity-section";
import { PatientAgendaSection } from "./patient-agenda-section";
import { PatientFavoritesSection } from "./patient-favorites-section";
import { PatientHeroCard } from "./patient-hero-card";
import { PatientMoodCheckin } from "./patient-mood-checkin";
import { PatientReviewPrompt } from "./patient-review-prompt";
import { PatientSupportSection } from "./patient-support-section";

export function PatientOverviewPage({
  data,
  onMoodChange,
}: {
  data: PatientOverview;
  onMoodChange?: (mood: MoodKey) => Promise<void>;
}) {
  return (
    <div className="mx-auto w-full max-w-[1174px] pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(290px,332px)] lg:gap-3">
      <div className="space-y-3">
        <PatientHeroCard patient={data.patient} />
        <PatientActivitySection activity={data.activitySummary} />
        <PatientAgendaSection appointments={data.upcomingAppointments} />
        <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
          <PatientFavoritesSection professionals={data.favoriteProfessionals} />
          <PatientReviewPrompt review={data.pendingReview} />
        </div>
      </div>
      <aside
        aria-label="Resumo de bem-estar e suporte"
        className="mt-3 space-y-3 lg:mt-0"
      >
        <PatientMoodCheckin
          latestMoodCheckin={data.latestMoodCheckin}
          moodOptions={data.moodOptions}
          onMoodChange={onMoodChange}
        />
        <PatientSupportSection tickets={data.supportTickets} />
      </aside>
    </div>
  );
}
