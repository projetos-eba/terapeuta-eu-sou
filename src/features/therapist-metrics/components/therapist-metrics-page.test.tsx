import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistMetricsOverview } from "../therapist-metrics.types";
import {
  TherapistMetricsErrorState,
  TherapistMetricsPage,
} from "./therapist-metrics-page";

afterEach(cleanup);

describe("TherapistMetricsPage", () => {
  it("renders the approved overview with own-history context", () => {
    render(<TherapistMetricsPage data={overviewFixture()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Métricas & Relatórios",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoas atendidas")).toBeInTheDocument();
    expect(screen.getByText("Sessões realizadas")).toBeInTheDocument();
    expect(screen.getByText("Tempo de atendimento")).toBeInTheDocument();
    expect(
      screen.getByText("Você atendeu mais pessoas do que no período anterior."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /comparações feitas apenas com o seu próprio histórico/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há comparação com outros profissionais nem tendência agregada do portal/i,
      ),
    ).toBeInTheDocument();
  });

  it("formats service minutes and renders the real activity series", () => {
    render(<TherapistMetricsPage data={overviewFixture()} />);

    expect(screen.getByText("6 h 30 min")).toBeInTheDocument();
    expect(screen.getByText("Período anterior: 7 h")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Sessões concluídas ao longo do período",
      }),
    ).toBeInTheDocument();
  });

  it("exposes the three shareable metric views", () => {
    render(<TherapistMetricsPage data={overviewFixture()} />);

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Sessões" })).toHaveAttribute(
      "href",
      "/terapeuta/insights?tab=sessions&period=30",
    );
    expect(screen.getByRole("link", { name: "Interesse" })).toHaveAttribute(
      "href",
      "/terapeuta/insights?tab=interest&period=30",
    );
    expect(screen.getByRole("link", { name: "Baixar relatório" })).toHaveAttribute(
      "href",
      "/api/therapist/metrics/export?tab=overview&period=30",
    );
  });

  it("does not simulate discovery while privacy activation is pending", () => {
    render(<TherapistMetricsPage data={overviewFixture()} />);

    expect(
      screen.getByText("Sinais de descoberta ainda não ativados"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Aparições na busca")).not.toBeInTheDocument();
  });

  it("protects favorites and ranking with the approved sample of ten", () => {
    render(<TherapistMetricsPage data={overviewFixture()} />);

    expect(
      screen.getByText(/esta métrica aparece a partir de 10 novos favoritos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/disponível após 10 sessões concluídas/i),
    ).toBeInTheDocument();
  });

  it("distinguishes legitimate zero data from infrastructure failure", () => {
    const empty = overviewFixture();
    empty.counters.peopleServed = {
      direction: "stable",
      directionCopyKey: "therapist_metrics.people_served.stable",
      previousValue: 0,
      status: "empty",
      unit: "people",
      value: 0,
    };

    const { rerender } = render(<TherapistMetricsPage data={empty} />);
    expect(
      screen.getByText("Ainda sem registros concluídos neste período."),
    ).toBeInTheDocument();

    rerender(
      <TherapistMetricsErrorState message="Não foi possível consultar suas métricas agora." />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Métricas indisponíveis",
      }),
    ).toBeInTheDocument();
  });
});

function overviewFixture(): TherapistMetricsOverview {
  return {
    activity: {
      freshThrough: "2026-07-28T03:00:00.000Z",
      points: [
        { date: "2026-07-26", sessionsCompleted: 1 },
        { date: "2026-07-27", sessionsCompleted: 2 },
      ],
      status: "ready",
    },
    contractVersion: 1,
    counters: {
      peopleServed: {
        direction: "up",
        directionCopyKey: "therapist_metrics.people_served.up",
        previousValue: 6,
        status: "ready",
        unit: "people",
        value: 8,
      },
      serviceMinutes: {
        direction: "down",
        directionCopyKey: "therapist_metrics.service_minutes.down",
        previousValue: 420,
        status: "ready",
        unit: "minutes",
        value: 390,
      },
      sessionsCompleted: {
        direction: "stable",
        directionCopyKey: "therapist_metrics.sessions_completed.stable",
        previousValue: 10,
        status: "ready",
        unit: "sessions",
        value: 10,
      },
    },
    discovery: {
      freshThrough: null,
      funnel: {
        profileToBooking: {
          direction: null,
          directionCopyKey: null,
          minimumSample: 10,
          observedSample: 0,
          previousValue: null,
          status: "insufficient_sample",
          unit: "percent",
          value: null,
        },
        searchToProfile: {
          direction: null,
          directionCopyKey: null,
          minimumSample: 10,
          observedSample: 0,
          previousValue: null,
          status: "insufficient_sample",
          unit: "percent",
          value: null,
        },
      },
      reason: "privacy_activation_pending",
      stages: {
        bookingFlowStarts: eventCounter("booking_flow_starts"),
        profileViews: eventCounter("profile_views"),
        searchImpressions: eventCounter("search_impressions"),
      },
      status: "unavailable",
    },
    meta: {
      computedAt: "2026-07-28T16:00:00.000Z",
      freshThrough: "2026-07-28T03:00:00.000Z",
      periodDays: 30,
      periodEnd: "2026-07-28T03:00:00.000Z",
      periodStart: "2026-06-28T03:00:00.000Z",
      previousPeriodEnd: "2026-06-28T03:00:00.000Z",
      previousPeriodStart: "2026-05-29T03:00:00.000Z",
      timezone: "America/Sao_Paulo",
    },
    metricDefinitionVersion: 1,
    occupancy: {
      reason: "historical_availability_not_versioned",
      status: "unavailable",
    },
    profileFavorites: {
      direction: null,
      directionCopyKey: null,
      minimumSample: 10,
      observedSample: 3,
      previousValue: null,
      status: "insufficient_sample",
      unit: "favorites",
      value: null,
    },
    therapist: {
      plan: "premium_plus",
      profileId: "c1000000-0000-4000-8000-000000000001",
    },
    therapyRanking: {
      items: [],
      minimumSample: 10,
      observedSample: 3,
      status: "insufficient_sample",
    },
  };
}

function eventCounter(
  key: "booking_flow_starts" | "profile_views" | "search_impressions",
) {
  return {
    direction: "stable" as const,
    directionCopyKey: `therapist_metrics.${key}.stable` as const,
    previousValue: 0,
    status: "empty" as const,
    unit: "events" as const,
    value: 0,
  };
}
