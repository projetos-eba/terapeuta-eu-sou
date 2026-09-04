import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistAuraCard } from "./therapist-aura-card";
import { TherapistRecentReviews } from "./therapist-recent-reviews";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { TherapistDashboardPage } from "../therapist-dashboard-page";
import { TherapistPlan } from "@/domain/tes";

describe("dashboard empty states", () => {
  it("renders clear empty states without mock records", () => {
    render(
      <>
        <UpcomingSessionsCard sessions={[]} />
        <TherapistRecentReviews reviews={[]} />
        <TherapistAuraCard aura={null} />
      </>,
    );

    expect(
      screen.getByText("Nenhuma sessão futura está agendada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("As avaliações publicadas aparecerão aqui."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A Aura ainda não tem recomendações/),
    ).toBeInTheDocument();
  });

  it("does not render the Aura card while its launch is disabled", () => {
    const { container } = render(
      <TherapistDashboardPage data={disabledData()} />,
    );

    expect(container.textContent).not.toContain("Assessora Aura");
  });
});

function disabledData() {
  return {
    attentionItems: [],
    aura: null,
    auraState: "disabled" as const,
    history: { activePatients: 0, averageRating: null, completedSessions: 0 },
    kpis: {
      activePatients: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      monthlyNetRevenueCents: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      monthlySessions: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      profileViews: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
    },
    recentReviews: [],
    recommendedActions: [],
    therapist: {
      avatarUrl: null,
      name: "Ana",
      plan: TherapistPlan.PremiumPlus,
      profileCompleteness: 100,
      profileId: "profile-id",
    },
    today: {
      newConnections: 0,
      pendingPayments: 0,
      pendingReviewReplies: 0,
      reservedMinutesToday: 0,
      rescheduleRequests: 0,
      sessionsToday: 0,
    },
    unreadMessagesCount: 0,
    unreadNotificationsCount: 0,
    upcomingSessions: [],
    upcomingSessionsState: "empty" as const,
    week: {
      attendanceRate: 0,
      days: [],
      rangeLabel: "",
      state: "empty" as const,
    },
  };
}
