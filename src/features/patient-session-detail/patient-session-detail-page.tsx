import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";

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
import { UsefulInfoCard } from "./components/useful-info-card";
import type { PatientSessionDetailPageData } from "./patient-session-detail.types";

export function PatientSessionDetailPage({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const showContextAside = data.booking.status !== "completed";

  return (
    <AppPageContainer className="max-w-[1140px] gap-8 pb-14 text-tesText-primary sm:gap-10">
      <SessionDetailHeader />
      <AppPageGrid
        className={
          showContextAside
            ? "gap-10 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start"
            : "gap-10"
        }
      >
        <AppPageMain className="gap-10">
          <SessionOverviewCard data={data} />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <SessionAboutCard data={data} />
            <SharedIntakeCard intake={data.intake} />
          </div>
          <OnlineSessionCard data={data} />
          <SessionActionCards data={data} />
          <section aria-labelledby="journey-with-therapist-heading">
            <h2
              className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]"
              id="journey-with-therapist-heading"
            >
              Sua jornada com {data.therapist.name}
            </h2>
          </section>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <PreparationCard data={data} />
            <CancellationPolicyCard policy={data.cancellationPolicy} />
          </div>
          {!showContextAside ? <UsefulInfoCard /> : null}
        </AppPageMain>
        {showContextAside ? (
          <AppPageAside className="gap-6 xl:sticky xl:top-28 xl:grid-cols-1 xl:self-start">
            <QuickSupportCard bookingId={data.booking.id} />
            <UsefulInfoCard compact />
            {typeof data.booking.minutesUntilStart === "number" ? (
              <ReminderCard booking={data.booking} />
            ) : null}
          </AppPageAside>
        ) : null}
      </AppPageGrid>
    </AppPageContainer>
  );
}
