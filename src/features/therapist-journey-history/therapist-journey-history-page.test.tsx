import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildJourneyHistoryHref,
  buildJourneyCsvHref,
  paginateJourneyClients,
  parseJourneyHistoryFilters,
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
      screen.getByRole("heading", {
        name: "Temas da jornada",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ainda não há temas compartilhados para mostrar."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Memória das sessões" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma preferência compartilhada nesta área"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Abrir sessão" })[0],
    ).toHaveAttribute("href", "/terapeuta/sessoes/booking-1");
  });
});

describe("TherapistJourneyHistoryPage", () => {
  it("keeps the portfolio hierarchy and an accessible export action", () => {
    const view = render(
      <TherapistJourneyHistoryPage
        data={pageFixture()}
        filters={{
          page: 1,
          q: "",
          segment: "",
          sort: "last_session",
          status: "all",
        }}
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
    expect(screen.queryByText("Pausadas")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sobre sem sessão recente" }),
    ).toHaveAttribute("title", "Sem sessão registrada nos últimos 30 dias.");
    expect(
      screen.queryByRole("columnheader", { name: "Encontros" }),
    ).not.toBeInTheDocument();
    expect(
      view.container.querySelector("svg.lucide-chevron-down"),
    ).toHaveClass("pointer-events-none");
  });

  it("paginates the same clients in the desktop table and mobile cards", () => {
    const clients = Array.from({ length: 13 }, (_, index) => ({
      ...detailFixture().client,
      id: `patient-${index + 1}`,
      name: `Cliente ${index + 1}`,
      timelineHref: `/terapeuta/pacientes/patient-${index + 1}`,
    }));

    render(
      <TherapistJourneyHistoryPage
        data={pageFixture(clients)}
        filters={{
          page: 1,
          q: "",
          segment: "",
          sort: "last_session",
          status: "all",
        }}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: /paginação/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mostrando 1–12 de 13 pessoas"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Próxima página" }),
    ).toHaveAttribute("href", "/terapeuta/pacientes?page=2");
    expect(screen.queryByText("Cliente 13")).not.toBeInTheDocument();
    expect(decodeURIComponent(buildJourneyCsvHref(clients))).toContain(
      '"Cliente 13"',
    );
  });

  it("normalizes pagination input and preserves active filters in links", () => {
    expect(
      parseJourneyHistoryFilters({
        page: "-2",
        q: "Ana",
        segment: "legacy",
        sort: "name",
        status: "active",
      }),
    ).toMatchObject({
      page: 1,
      q: "Ana",
      segment: "",
      sort: "name",
      status: "active",
    });

    expect(
      buildJourneyHistoryHref(
        {
          page: 1,
          q: "Ana",
          segment: "legacy",
          sort: "name",
          status: "active",
        },
        2,
      ),
    ).toBe("/terapeuta/pacientes?q=Ana&status=active&sort=name&page=2");
  });

  it.each([
    {
      count: 0,
      expectedLength: 0,
      expectedPage: 1,
      expectedTotalPages: 0,
      name: "zero",
      requestedPage: 1,
    },
    {
      count: 1,
      expectedLength: 1,
      expectedPage: 1,
      expectedTotalPages: 1,
      name: "one",
      requestedPage: 1,
    },
    {
      count: 12,
      expectedLength: 12,
      expectedPage: 1,
      expectedTotalPages: 1,
      name: "twelve",
      requestedPage: 1,
    },
    {
      count: 13,
      expectedLength: 1,
      expectedPage: 2,
      expectedTotalPages: 2,
      name: "next page",
      requestedPage: 2,
    },
    {
      count: 13,
      expectedLength: 12,
      expectedPage: 1,
      expectedTotalPages: 2,
      name: "negative page",
      requestedPage: -3,
    },
    {
      count: 13,
      expectedLength: 1,
      expectedPage: 2,
      expectedTotalPages: 2,
      name: "page beyond total",
      requestedPage: 99,
    },
  ])(
    "handles $name result sets and page values",
    ({
      count,
      expectedLength,
      expectedPage,
      expectedTotalPages,
      requestedPage,
    }) => {
      const clients = Array.from({ length: count }, (_, index) => ({
        ...detailFixture().client,
        id: `patient-${index + 1}`,
        name: `Cliente ${index + 1}`,
      }));

      const result = paginateJourneyClients(clients, requestedPage);

      expect(result.pagination).toMatchObject({
        page: expectedPage,
        pageSize: 12,
        total: count,
        totalPages: expectedTotalPages,
      });
      expect(result.clients).toHaveLength(expectedLength);
    },
  );
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
      topicLabels: [],
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
        topicLabels: [],
      },
    ],
  };
}

function pageFixture(
  clients: JourneyHistoryPageData["clients"] = [detailFixture().client],
): JourneyHistoryPageData {
  return {
    clients,
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
        description: "Com sessão nos últimos 30 dias",
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
        description: "Sem sessão há mais de 30 dias",
        id: "stale",
        label: "Sem sessão recente",
        tone: "danger",
        value: 0,
      },
    ],
    reminders: [],
    segments: [],
    source: "supabase",
    summary: { active: 1, paused: 0, stale: 0, total: 1 },
    therapistProfileId: "therapist-1",
  };
}
