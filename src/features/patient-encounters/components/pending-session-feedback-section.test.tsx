import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingSessionFeedbackSection } from "./pending-session-feedback-section";

vi.mock("@/features/session-feedback", () => ({
  PatientSessionFeedbackDialog: ({ session }: { session: { bookingId: string } }) => (
    <div data-testid="feedback-dialog">{session.bookingId}</div>
  ),
}));

afterEach(cleanup);

describe("PendingSessionFeedbackSection", () => {
  const sessions = [
    session("booking-1", "Ana"),
    session("booking-2", "Beatriz"),
  ];

  it("lists every pending encounter and opens the selected booking", () => {
    render(<PendingSessionFeedbackSection sessions={sessions} />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beatriz")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Confirmar encontro" })[1]);
    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent("booking-2");
  });

  it("honors an explicit feedback query target", () => {
    render(
      <PendingSessionFeedbackSection
        initialBookingId="booking-1"
        sessions={sessions}
      />,
    );
    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent("booking-1");
  });

  it("reacts when client navigation selects another query target", () => {
    const { rerender } = render(
      <PendingSessionFeedbackSection sessions={sessions} />,
    );

    rerender(
      <PendingSessionFeedbackSection
        initialBookingId="booking-2"
        sessions={sessions}
      />,
    );

    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent("booking-2");
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
