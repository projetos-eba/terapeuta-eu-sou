import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientReviewPrompt } from "./patient-review-prompt";

afterEach(cleanup);

describe("PatientReviewPrompt", () => {
  it("sends the latest-session prompt to encounter details", () => {
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

    expect(
      screen.getByRole("link", { name: "Ver detalhes do encontro" }),
    ).toHaveAttribute("href", "/app/encontros/booking-latest?feedback=1");
  });
});
