import type { TherapistDashboardPageData } from "./therapist-dashboard.types";
import { TherapistAttentionSection } from "./components/therapist-attention-section";
import { TherapistAuraCard } from "./components/therapist-aura-card";
import { TherapistJourneyHistory } from "./components/therapist-journey-history";
import { TherapistKpiGrid } from "./components/therapist-kpi-grid";
import { TherapistRecentReviews } from "./components/therapist-recent-reviews";
import { TherapistRecommendedActions } from "./components/therapist-recommended-actions";
import { TherapistWeekSummary } from "./components/therapist-week-summary";
import { TherapistWelcomeHero } from "./components/therapist-welcome-hero";
import { UpcomingSessionsCard } from "./components/upcoming-sessions-card";

export function TherapistDashboardPage({
  data,
}: {
  data: TherapistDashboardPageData;
}) {
  return (
    <div className="mx-auto max-w-[1360px] space-y-6 pb-10">
      <TherapistWelcomeHero data={data} />
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_306px]">
      <TherapistWeekSummary plan={data.therapist.plan} week={data.week} />
        <UpcomingSessionsCard sessions={data.upcomingSessions} />
      </div>
      <TherapistKpiGrid kpis={data.kpis} plan={data.therapist.plan} />
      <TherapistAttentionSection items={data.attentionItems} />
      <TherapistAuraCard aura={data.aura} plan={data.therapist.plan} />
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.17fr]">
        <TherapistJourneyHistory
          history={data.history}
          plan={data.therapist.plan}
        />
        <TherapistRecommendedActions
          actions={data.recommendedActions}
          plan={data.therapist.plan}
        />
        <TherapistRecentReviews
          plan={data.therapist.plan}
          reviews={data.recentReviews}
        />
      </div>
    </div>
  );
}
