import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingSessionFeedbackSection } from "./pending-session-feedback-section";

const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

vi.mock("@/features/session-feedback", () => ({
  PatientSessionFeedbackDialog: ({
    onClose,
    onSessionSubmitted,
    session,
  }: {
    onClose: () => void;
    onSessionSubmitted: () => void;
    session: { bookingId: string };
  }) => (
    <div data-testid="feedback-dialog">
      {session.bookingId}
      <button onClick={onSessionSubmitted} type="button">
        Simular confirmação
      </button>
      <button onClick={onClose} type="button">
        Fechar confirmação
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  routerRefresh.mockReset();
});

describe("PendingSessionFeedbackSection", () => {
  const sessions = [
    session("booking-1", "Ana"),
    session("booking-2", "Beatriz"),
  ];

  it("lists every pending encounter and opens the selected booking", () => {
    render(<PendingSessionFeedbackSection sessions={sessions} />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beatriz")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Confirmar encontro" })[1],
    );
    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent(
      "booking-2",
    );
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

  it("honors an explicit feedback query target", () => {
    render(
      <PendingSessionFeedbackSection
        initialBookingId="booking-1"
        sessions={sessions}
      />,
    );
    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent(
      "booking-1",
    );
  });

  it("refreshes the history after a confirmation is submitted", () => {
    render(
      <PendingSessionFeedbackSection
        initialBookingId="booking-1"
        sessions={sessions}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Simular confirmação" }),
    );

    expect(routerRefresh).toHaveBeenCalledTimes(1);
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

    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent(
      "booking-2",
    );
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
