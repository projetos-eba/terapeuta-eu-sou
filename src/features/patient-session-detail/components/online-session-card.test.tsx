import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingStatus, SessionFinancialStatus } from "@/domain/tes";
import {
  getPatientEncounterActionPolicy,
  getPatientEncounterPresentationState,
} from "@/features/bookings";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";
import { OnlineSessionCard } from "./online-session-card";

describe("OnlineSessionCard", () => {
  it("does not enable the dedicated room when payment is not confirmed", () => {
    render(
      <OnlineSessionCard
        data={makeData({
          financialStatus: SessionFinancialStatus.Pending,
        })}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /ir para a sala segura/i }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /pedir ajuda com pagamento/i }),
    ).toHaveAttribute(
      "href",
      "/app/mensagens?context=suporte&booking=f2000000-0000-4000-8000-000000000001",
    );
  });

  it("shows the secure room guidance only after confirmed payment", () => {
    render(
      <OnlineSessionCard
        data={makeData({
          financialStatus: SessionFinancialStatus.Paid,
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: /ir para a sala segura/i }),
    ).toHaveAttribute(
      "href",
      "/app/encontros/f2000000-0000-4000-8000-000000000001/video",
    );
  });

  it("does not expose raw meeting URLs for external providers", () => {
    render(
      <OnlineSessionCard
        data={makeData({
          canJoin: true,
          financialStatus: SessionFinancialStatus.Paid,
          meetingUrl: "https://example.com/meeting",
          provider: "external",
        })}
      />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /abrir videochamada/i }),
    ).toHaveAttribute("href", "https://example.com/meeting");
  });
});

function makeData({
  canJoin,
  financialStatus,
  meetingUrl = null,
  provider = "zoom",
}: {
  canJoin?: boolean;
  financialStatus: SessionFinancialStatus;
  meetingUrl?: string | null;
  provider?: "external" | "google_meet" | "zoom";
}): PatientSessionDetailPageData {
  const booking = {
    canJoin: canJoin ?? financialStatus === SessionFinancialStatus.Paid,
    dateLabel: "Sábado, 01 de ago",
    durationLabel: "1h de duração",
    endsAt: "2026-08-01T15:00:00.000Z",
    id: "f2000000-0000-4000-8000-000000000001",
    minutesUntilStart: 10,
    operationalVersion: 1,
    paymentStatus: financialStatus,
    startsAt: "2026-08-01T14:00:00.000Z",
    status: BookingStatus.Confirmed,
    statusLabel: "Confirmada",
    timeRangeLabel: "11:00 - 12:00",
    timezone: "America/Sao_Paulo",
  } satisfies PatientSessionDetailPageData["booking"];

  return {
    actionPolicy: getPatientEncounterActionPolicy({
      bookingStatus: booking.status,
      cancellationPolicy: {
        freeUntilHours: 24,
        lateCancelFeePercent: 50,
        noShowFeePercent: 100,
      },
      endsAt: booking.endsAt,
      financialStatus,
      now: new Date("2026-08-01T13:50:00.000Z"),
      startsAt: booking.startsAt,
    }),
    booking,
    cancellationPolicy: {
      freeUntilHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
    },
    encounterState: getPatientEncounterPresentationState({
      bookingStatus: booking.status,
      endsAt: booking.endsAt,
      financialStatus,
      now: new Date("2026-08-01T13:50:00.000Z"),
      provider,
      startsAt: booking.startsAt,
    }),
    intake: {
      focusArea: "Seu momento atual",
      sharedNote: "Nota compartilhada",
      therapyGoal: "Acompanhar sua jornada.",
      visibility: "patient_therapist",
    },
    journey: {
      completedEncountersCount: 0,
      lastExploredTopic: "Reiki",
      startedAtLabel: "Agosto de 2026",
      therapistName: "Ana",
    },
    onlineSession: {
      joinRecommendation: "Entre alguns minutos antes.",
      meetingUrl,
      provider,
      securityNote: "Acesso autenticado.",
    },
    patient: {
      avatarUrl: null,
      id: "b1000000-0000-4000-8000-000000000001",
      name: "Paciente",
    },
    receipt: {
      amountCents: null,
      currency: "BRL",
      paidAt: null,
      receiptUrl: null,
    },
    reschedule: null,
    service: {
      id: "service-id",
      objective: "Cuidado responsável.",
      therapyName: "Reiki",
      therapySlug: "reiki",
      title: "Reiki online",
    },
    therapist: {
      avatarUrl: null,
      id: "c1000000-0000-4000-8000-000000000001",
      isOnline: true,
      name: "Ana Oliveira",
      profileHref: "/terapeutas/ana-oliveira",
      ratingAverage: null,
      reviewsCount: 0,
      roleLabel: "Terapeuta",
    },
  };
}
