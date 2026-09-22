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
          statusLabel: "Confirmada",
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
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute(
      "href",
      "/app/encontros/booking-1",
    );
    expect(menuButton.parentElement).toHaveClass("relative", "shrink-0");
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

  it("exibe somente o estado canônico ao vivo e libera a entrada", () => {
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
          statusLabel: "Ao vivo agora",
          therapyLabel: "Reiki",
          timezone: "America/Sao_Paulo",
        }}
      />,
    );

    expect(screen.queryByText("Confirmada")).not.toBeInTheDocument();
    expect(screen.getByText("Ao vivo agora")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entrar no encontro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entrar no encontro" }),
    ).toHaveClass("min-h-10", "w-[145px]");
    expect(
      screen.getByRole("button", { name: "Abrir ações do encontro" }),
    ).toHaveClass("size-10");
    expect(
      screen.queryByRole("link", { name: "Abrir chamado" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["pending_payment", "Reservado"],
    ["cancelled", "Encontro cancelado"],
    ["reschedule_requested", "Reagendamento solicitado"],
  ] as const)("exibe o estado %s recebido da agenda completa", (status, label) => {
    render(
      <PatientAppointmentCard
        appointment={{
          endsAt: "2026-08-29T16:00:00.000Z",
          id: `booking-${status}`,
          meetingUrl: null,
          professional: {
            avatarUrl: null,
            id: "therapist-1",
            name: "Ana Oliveira",
          },
          serviceLabel: "Reiki online",
          startsAt: "2026-08-29T15:00:00.000Z",
          status,
          statusLabel: label,
          therapyLabel: "Reiki",
          timezone: "America/Sao_Paulo",
        }}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver detalhes" }),
    ).toHaveAttribute("href", `/app/encontros/booking-${status}`);
  });
});
