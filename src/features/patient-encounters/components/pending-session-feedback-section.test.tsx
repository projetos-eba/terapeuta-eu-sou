import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PendingSessionFeedbackSection } from "./pending-session-feedback-section";

afterEach(cleanup);

describe("PendingSessionFeedbackSection", () => {
  const sessions = [
    session("booking-1", "Ana"),
    session("booking-2", "Beatriz"),
  ];

  it("lists every pending encounter and sends each action to its details", () => {
    render(<PendingSessionFeedbackSection sessions={sessions} />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beatriz")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Ver detalhes do encontro" })[1],
    ).toHaveAttribute("href", "/app/encontros/booking-2?feedback=1");
  });

  it("uses the responsive two-column grid and scroll region for larger queues", () => {
    const manySessions = Array.from({ length: 5 }, (_, index) =>
      session(`booking-${index + 1}`, `Terapeuta ${index + 1}`),
    );

    render(<PendingSessionFeedbackSection sessions={manySessions} />);

    const scrollRegion = screen.getByRole("region", {
      name: "Lista de confirmações pendentes",
    });
    expect(scrollRegion).toHaveAttribute(
      "data-testid",
      "pending-feedback-scroll",
    );
    expect(scrollRegion).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
      "max-h-[34rem]",
      "lg:max-h-[20rem]",
      "overflow-y-auto",
    );
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });

});

function session(bookingId: string, name: string) {
  return {
    bookingId,
    confirmationState: "awaiting_patient" as const,
    endsAt: "2026-08-25T15:00:00.000Z",
    serviceLabel: "Reiki online",
    startsAt: "2026-08-25T14:00:00.000Z",
    therapist: { avatarUrl: null, id: `therapist-${bookingId}`, name },
    therapyLabel: "Reiki",
    timezone: "America/Sao_Paulo",
  };
}
