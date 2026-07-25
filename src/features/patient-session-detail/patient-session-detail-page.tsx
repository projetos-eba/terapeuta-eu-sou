import { CancellationPolicyCard } from "./components/cancellation-policy-card";
import { OnlineSessionCard } from "./components/online-session-card";
import { PreparationCard } from "./components/preparation-card";
import { QuickSupportCard } from "./components/quick-support-card";
import { ReminderCard } from "./components/reminder-card";
import { SessionAboutCard } from "./components/session-about-card";
import { SessionActionCards } from "./components/session-action-cards";
import { SessionDetailHeader } from "./components/session-detail-header";
import { SessionOverviewCard } from "./components/session-overview-card";
import { SharedIntakeCard } from "./components/shared-intake-card";
import { TherapistJourneyCard } from "./components/therapist-journey-card";
import { UsefulInfoCard } from "./components/useful-info-card";
import type { PatientSessionDetailPageData } from "./patient-session-detail.types";

export function PatientSessionDetailPage({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <main className="pb-10 text-tesText-primary">
      <SessionDetailHeader />
      <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,790px)_300px] xl:items-start">
        <div className="space-y-6">
          <SessionOverviewCard data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <SessionAboutCard data={data} />
            <SharedIntakeCard intake={data.intake} />
          </div>
          <OnlineSessionCard data={data} />
          <SessionActionCards data={data} />
          <TherapistJourneyCard data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <PreparationCard />
            <CancellationPolicyCard policy={data.cancellationPolicy} />
          </div>
        </div>
        <aside className="grid gap-6 xl:sticky xl:top-28">
          <QuickSupportCard bookingId={data.booking.id} />
          <UsefulInfoCard />
          <ReminderCard booking={data.booking} />
        </aside>
      </div>
    </main>
  );
}
