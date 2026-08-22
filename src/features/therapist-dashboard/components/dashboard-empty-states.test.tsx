import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistAuraCard } from "./therapist-aura-card";
import { TherapistRecentReviews } from "./therapist-recent-reviews";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";

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
});
