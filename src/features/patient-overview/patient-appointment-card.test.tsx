import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientAppointmentCard } from "./patient-appointment-card";

afterEach(cleanup);

describe("PatientAppointmentCard", () => {
  it("opens the encounter actions from the top-right menu", () => {
    render(
      <PatientAppointmentCard
        appointment={{
          endsAt: "2026-08-27T16:00:00.000Z",
          id: "booking-1",
          meetingUrl: null,
          professional: {
            avatarUrl: null,
            id: "therapist-1",
            name: "Ana Oliveira",
          },
          serviceLabel: "Reiki online",
          startsAt: "2026-08-27T15:00:00.000Z",
          status: "confirmed",
          therapyLabel: "Reiki",
          timezone: "America/Sao_Paulo",
        }}
      />,
    );

    const menuButton = screen.getByRole("button", {
      name: "Abrir ações do encontro",
    });
    const card = screen.getByRole("article");
    const columns = Array.from(card.children);

    expect(columns[2]).toHaveTextContent("Confirmada");
    expect(columns[3]?.tagName).toBe("DL");
    expect(columns[4]).toHaveTextContent("Ver detalhes");
    expect(columns[5]).toContainElement(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Ver detalhes" }),
    ).toHaveAttribute("href", "/app/encontros/booking-1");
  });
});
