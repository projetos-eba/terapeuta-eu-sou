import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientAppointmentCard } from "./patient-appointment-card";
import { isPatientAppointmentLive } from "./patient-overview.live";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    expect(
      screen.getByRole("link", { name: "Ver detalhes" }),
    ).toHaveAttribute("href", "/app/encontros/booking-1");
    expect(menuButton.parentElement).toHaveClass(
      "absolute",
      "right-3",
      "top-3",
    );
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Ver detalhes" }),
    ).toHaveAttribute("href", "/app/encontros/booking-1");
  });

  it.each([
    ["16 minutos antes", "2026-08-27T14:44:00.000Z", false],
    ["15 minutos antes", "2026-08-27T14:45:00.000Z", true],
    ["no início", "2026-08-27T15:00:00.000Z", true],
    ["no encerramento", "2026-08-27T16:00:00.000Z", true],
    ["depois do encerramento", "2026-08-27T16:00:00.001Z", false],
  ])("considera a sessão ao vivo %s", (_label, now, expected) => {
    expect(
      isPatientAppointmentLive(
        {
          endsAt: "2026-08-27T16:00:00.000Z",
          startsAt: "2026-08-27T15:00:00.000Z",
        },
        Date.parse(now),
      ),
    ).toBe(expected);
  });

  it("exibe Confirmada e o badge Ao vivo durante a janela de entrada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T14:45:00.000Z"));

    render(
      <PatientAppointmentCard
        appointment={{
          endsAt: "2026-08-27T16:00:00.000Z",
          id: "booking-live",
          meetingUrl: null,
          professional: {
            avatarUrl: null,
            id: "therapist-1",
            name: "Ana Oliveira",
          },
          serviceLabel: "Reiki online",
          startsAt: "2026-08-27T15:00:00.000Z",
          status: "live",
          therapyLabel: "Reiki",
          timezone: "America/Sao_Paulo",
        }}
      />,
    );

    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entrar no encontro" }),
    ).toBeInTheDocument();
  });
});
