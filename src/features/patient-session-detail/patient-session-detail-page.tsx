import {
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
import { SessionStatusStrip } from "./components/session-status-strip";
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
    <AppPageContainer className="max-w-[1146px] gap-5 pb-14 text-tesText-primary sm:gap-6 lg:gap-7">
      <SessionDetailHeader />
      <SessionOverviewCard data={data} />
      <SessionStatusStrip data={data} />

      <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_296px] xl:items-start xl:gap-6">
        {showContextAside ? (
          <div className="order-1 grid min-w-0 gap-5 lg:order-2 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-28">
            <div className="grid grid-cols-2 gap-3 max-[370px]:grid-cols-1 xl:grid-cols-1 xl:gap-5">
              <QuickSupportCard bookingId={data.booking.id} />
              {typeof data.booking.minutesUntilStart === "number" ? (
                <ReminderCard booking={data.booking} />
              ) : null}
            </div>
            <div className="hidden lg:block">
              <UsefulInfoCard compact />
            </div>
          </div>
        ) : null}

        <AppPageMain
          className={
            showContextAside
              ? "order-2 gap-5 lg:order-1 xl:col-start-1 xl:row-span-2"
              : "order-1 gap-5 lg:order-1 xl:col-span-2"
          }
        >
          <SessionAboutCard data={data} />
          <SharedIntakeCard intake={data.intake} />
          <OnlineSessionCard data={data} />
          <SessionActionCards data={data} />
          {showContextAside ? (
            <div className="lg:hidden">
              <UsefulInfoCard />
            </div>
          ) : (
            <UsefulInfoCard />
          )}
        </AppPageMain>

        <div
          className={
            showContextAside
              ? "order-3 grid gap-5 lg:order-3 xl:col-start-2 xl:row-start-2"
              : "order-2 grid gap-5 lg:order-2 xl:col-span-2"
          }
        >
          <PreparationCard data={data} />
          <CancellationPolicyCard policy={data.cancellationPolicy} />
        </div>
      </AppPageGrid>
    </AppPageContainer>
  );
}
