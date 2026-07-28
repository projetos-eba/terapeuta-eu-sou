import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AttendanceSource,
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
} from "@/domain/tes";

import type { TherapistCalendarReadModel } from "../therapist-calendar.types";
import { TherapistCalendar } from "./therapist-calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("TherapistCalendar", () => {
  it("renders real calendar controls and connected Agenda tabs", () => {
    render(<TherapistCalendar data={calendarFixture()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Horários" })).toHaveAttribute(
      "href",
      "?aba=horarios",
    );
    expect(screen.getByRole("link", { name: "Bloqueios" })).toHaveAttribute(
      "href",
      "?aba=bloqueios",
    );
    expect(screen.getByRole("link", { name: "Semana" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens an accessible booking dialog linked to the canonical session", () => {
    const fixture = calendarFixture();
    render(<TherapistCalendar data={fixture} />);

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Reiki com Beatriz Almeida/,
      })[0]!,
    );

    expect(
      screen.getByRole("dialog", { name: "Beatriz Almeida" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir sessão/ })).toHaveAttribute(
      "href",
      `/terapeuta/sessoes/${fixture.bookings[0]?.bookingId}`,
    );
  });

  it("shows explicit empty operational states without inventing encounters", () => {
    const fixture = calendarFixture();
    fixture.bookings = [];
    fixture.attentionItems = [];

    render(<TherapistCalendar data={fixture} />);

    expect(
      screen.getByText("Nenhum encontro agendado para hoje."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma pendência operacional neste momento."),
    ).toBeInTheDocument();
  });

  it("filters calendar events and keeps a dedicated chronological mobile list", () => {
    render(<TherapistCalendar data={calendarFixture()} />);

    expect(
      screen.getByRole("region", { name: "Lista cronológica da agenda" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "sem resultado" },
    });

    expect(
      screen.getByText("0 de 1 encontro(s) nesta visualização."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum item encontrado com os filtros atuais."),
    ).toBeInTheDocument();
  });
});

function calendarFixture(): TherapistCalendarReadModel {
  return {
    anchorDate: "2026-07-27",
    attentionItems: [
      {
        bookingId: "f2000000-0000-4000-8000-000000000001",
        description: "Pediu reagendamento",
        id: "a5000000-0000-4000-8000-000000000001",
        kind: "reschedule",
        startsAt: "2026-07-27T12:00:00.000Z",
        title: "Beatriz Almeida",
      },
    ],
    blocks: [],
    bookings: [
      {
        attendanceSource: AttendanceSource.Unavailable,
        attendanceStatus: AttendanceStatus.Pending,
        bookingId: "f2000000-0000-4000-8000-000000000001",
        bookingStatus: BookingStatus.Confirmed,
        bookingVersion: 1,
        cancellationDecision: null,
        cancellationRequiresReview: false,
        colorKey: "purple",
        currency: "BRL",
        durationMinutes: 50,
        endsAt: "2026-07-27T12:50:00.000Z",
        financialStatus: SessionFinancialStatus.Paid,
        fulfillmentStatus: FulfillmentStatus.Scheduled,
        grossAmountCents: 17000,
        modality: "online",
        patientAvatarUrl: null,
        patientName: "Beatriz Almeida",
        patientProfileId: "b1000000-0000-4000-8000-000000000001",
        priceCents: 17000,
        proposedEndsAt: null,
        proposedStartsAt: null,
        proposedTimezone: null,
        refundPending: false,
        rescheduleStatus: null,
        serviceId: "d1000000-0000-4000-8000-000000000001",
        serviceTitle: "Reiki",
        startsAt: "2026-07-27T12:00:00.000Z",
        therapistAmountCents: 14450,
        therapyId: "22222222-2222-4222-8222-222222222225",
        therapyName: "Reiki",
        timezone: "America/Sao_Paulo",
        transferStatus: "not_scheduled",
        videoSessionProvider: "zoom_video_sdk",
        videoSessionStatus: ZoomVideoSessionStatus.Ready,
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-27T11:45:00.000Z",
          availableUntil: "2026-07-27T13:20:00.000Z",
          reason: ZoomAccessReason.TooEarly,
          videoSessionStatus: ZoomVideoSessionStatus.Ready,
        },
      },
    ],
    contractVersion: 1,
    demand: [{ count: 3, dayOfWeek: 1, hourBlock: 8 }],
    holds: [],
    range: {
      end: "2026-08-03T03:00:00.000Z",
      endExclusive: true,
      localEndExclusive: "2026-08-03",
      localStart: "2026-07-27",
      start: "2026-07-27T03:00:00.000Z",
    },
    services: [
      {
        colorKey: "purple",
        durationMinutes: 50,
        id: "d1000000-0000-4000-8000-000000000001",
        therapyId: "22222222-2222-4222-8222-222222222225",
        therapyName: "Reiki",
        title: "Reiki",
      },
    ],
    summary: { activeHolds: 0, bookings: 1, pendingAttention: 1 },
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    timezone: "America/Sao_Paulo",
    view: "week",
  };
}
