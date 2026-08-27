import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientReviewPrompt } from "./patient-review-prompt";

vi.mock("@/features/session-feedback", () => ({
  PatientSessionFeedbackDialog: ({ session }: { session: { bookingId: string } }) => (
    <div data-testid="feedback-dialog">{session.bookingId}</div>
  ),
}));

afterEach(cleanup);

describe("PatientReviewPrompt", () => {
  it("opens the latest-session dialog only after the patient clicks", () => {
    render(
      <PatientReviewPrompt
        review={{
          appointmentId: "booking-latest",
          confirmationState: "awaiting_patient",
          endsAt: "2026-08-25T15:00:00.000Z",
          professional: { avatarUrl: null, id: "therapist-1", name: "Ana" },
          serviceLabel: "Reiki online",
          startsAt: "2026-08-25T14:00:00.000Z",
          therapyLabel: "Reiki",
          timezone: "America/Sao_Paulo",
        }}
      />,
    );

    expect(screen.queryByTestId("feedback-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar encontro" }));
    expect(screen.getByTestId("feedback-dialog")).toHaveTextContent("booking-latest");
  });
});
