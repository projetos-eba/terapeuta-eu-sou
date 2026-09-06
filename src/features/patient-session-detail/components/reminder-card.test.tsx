import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BookingStatus } from "@/domain/tes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";
import { ReminderCard } from "./reminder-card";

describe("ReminderCard", () => {
  afterEach(cleanup);

  it("shows the countdown for an upcoming confirmed encounter", () => {
    render(
      <ReminderCard booking={booking({ status: BookingStatus.Confirmed })} />,
    );

    expect(screen.getByText("Seu encontro se aproxima")).toBeInTheDocument();
  });

  it.each([
    BookingStatus.CancelledByPatient,
    BookingStatus.CancelledByTherapist,
    BookingStatus.CancelledByPayment,
    BookingStatus.Refunded,
  ])("hides the future countdown for terminal status %s", (status) => {
    const { container } = render(
      <ReminderCard booking={booking({ status })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

function booking({
  status,
}: {
  status: PatientSessionDetailPageData["booking"]["status"];
}) {
  return {
    minutesUntilStart: 120,
    status,
  } as PatientSessionDetailPageData["booking"];
}
