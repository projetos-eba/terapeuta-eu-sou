import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TherapistJourneyDetailPage,
  TherapistJourneyHistoryPage,
} from "./therapist-journey-history-page";
import type {
  JourneyHistoryDetailData,
  JourneyHistoryPageData,
} from "./therapist-journey-history.types";

describe("TherapistJourneyDetailPage", () => {
  it("organizes the journey around safe operational records", () => {
    render(<TherapistJourneyDetailPage data={detailFixture()} />);

    expect(
      screen.getByRole("heading", { name: "Ana Lima" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Temas identificados nos registros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Memória dos encontros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma preferência compartilhada nesta superfície"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Abrir sessão" })[0]).toHaveAttribute(
      "href",
      "/terapeuta/sessoes/booking-1",
    );
  });
});

describe("TherapistJourneyHistoryPage", () => {
  it("keeps the portfolio hierarchy and an accessible export action", () => {
    render(
      <TherapistJourneyHistoryPage
        data={pageFixture()}
        filters={{ q: "", segment: "", sort: "last_session", status: "all" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pessoas que caminham com você" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Exportar histórico da jornada" }),
    ).toHaveAttribute("download", "historico-da-jornada-tes.csv");
    expect(
      screen.getByRole("heading", { name: "Resumo das pessoas acompanhadas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveClass(
      "auto-rows-min",
      "self-start",
      "content-start",
      "xl:!block",
    );
    expect(
      screen
        .getByRole("heading", { name: "Resumo das pessoas acompanhadas" })
        .closest("section"),
    ).toHaveClass("h-auto", "self-start", "xl:mb-5");
    expect(screen.getAllByText("Pessoas acompanhadas")).not.toHaveLength(0);
    expect(screen.queryByRole("columnheader", { name: "Encontros" })).not.toBeInTheDocument();
  });
});

function detailFixture(): JourneyHistoryDetailData {
  return {
    client: {
      avatarUrl: null,
      emailLabel: "Cliente TES",
      firstSessionAt: "2026-05-12T14:00:00-03:00",
      id: "patient-1",
      lastSessionAt: "2026-07-16T14:00:00-03:00",
      lastSessionServiceTitle: "Reiki",
      name: "Ana Lima",
      nextSessionAt: "2026-08-20T14:00:00-03:00",
      nextSessionServiceTitle: "Aromaterapia",
      sessionsHref: "/terapeuta/sessoes?patient=patient-1",
      status: "active",
      therapyLabels: ["Reiki", "Aromaterapia"],
      timelineHref: "/terapeuta/pacientes/patient-1",
      topicLabels: ["Autoconhecimento", "Espiritualidade"],
      totalEncounters: 3,
    },
    source: "supabase",
    therapistProfileId: "therapist-1",
    timeline: [
      {
        bookingId: "booking-1",
        date: "2026-07-16T14:00:00-03:00",
        description: "Registro compartilhado para continuidade da jornada.",
        href: "/terapeuta/sessoes/booking-1",
        id: "booking-1",
        serviceTitle: "Reiki",
        status: "completed",
        title: "Clareza para o próximo encontro",
        topicLabels: ["Autoconhecimento"],
      },
    ],
  };
}

function pageFixture(): JourneyHistoryPageData {
  const client = detailFixture().client;

  return {
    clients: [client],
    metrics: [
      {
        description: "Todas as pessoas registradas",
        id: "total",
        label: "Pessoas acompanhadas",
        tone: "brand",
        trendLabel: "visão atual",
        value: 1,
      },
      {
        description: "Com retorno nos últimos 30 dias",
        id: "active",
        label: "Em acompanhamento",
        tone: "success",
        value: 1,
      },
      {
        description: "Relações iniciadas neste mês",
        id: "new",
        label: "Novas pessoas",
        tone: "warning",
        value: 1,
      },
      {
        description: "Há mais de 60 dias",
        id: "stale",
        label: "Sem encontro recente",
        tone: "danger",
        value: 0,
      },
    ],
    reminders: [],
    segments: [
      {
        count: 1,
        id: "autoconhecimento",
        label: "Autoconhecimento",
        tone: "brand",
      },
    ],
    source: "supabase",
    summary: { active: 1, paused: 0, stale: 0, total: 1 },
    therapistProfileId: "therapist-1",
  };
}
