import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistMetricsDashboard } from "../therapist-metrics.types";
import {
  aggregateSparklineToThree,
  TherapistMetricsErrorState,
  TherapistMetricsPage,
} from "./therapist-metrics-page";

afterEach(cleanup);

describe("TherapistMetricsPage", () => {
  it("consolidates the top sparkline into three truthful contiguous sums", () => {
    expect(
      aggregateSparklineToThree(
        Array.from({ length: 6 }, (_, index) => ({
          label: `d${index + 1}`,
          value: index + 1,
        })),
      ),
    ).toEqual([
      { label: "d1–d2", value: 3 },
      { label: "d3–d4", value: 7 },
      { label: "d5–d6", value: 11 },
    ]);
  });

  it("renders the six visual indicators and canonical tabs", () => {
    render(<TherapistMetricsPage data={dashboardFixture()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Acompanhe seu trabalho" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Visualizações do perfil").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Interessados em agendar").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Sessões realizadas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taxa de retorno").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ocupação da agenda").length).toBeGreaterThan(0);
    expect(screen.getByText("Terapia mais realizada")).toBeInTheDocument();
    expect(screen.getByText("Agenda e horários")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Gerenciar agenda" }),
    ).toHaveAttribute("href", "/terapeuta/agenda");
    expect(screen.getByText("Pessoas acompanhadas")).toBeInTheDocument();
    expect(screen.getByText("Top terapias")).toBeInTheDocument();
    expect(
      screen.getByText("Comparativo com o período anterior"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sessões" })).toHaveAttribute(
      "href",
      "/terapeuta/insights?tab=sessions&period=30",
    );
  });

  it("keeps the visual references visible without presenting unavailable collection as data", () => {
    render(<TherapistMetricsPage data={dashboardFixture()} />);

    expect(
      screen.getByText(
        "A estrutura do funil está pronta. Os números de descoberta só aparecem após a ativação formal e segura dessa coleta.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Mapa de calor de sessões: ainda sem dados"),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole("img", {
        name: "Tendência de Visualizações do perfil: ainda sem dados",
      }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("2.842")).not.toBeInTheDocument();
    expect(screen.queryByText("Avaliações recebidas")).not.toBeInTheDocument();
    expect(screen.queryByText("Nota média")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Insights & oportunidades"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Mapa de calor de sessões: ainda sem dados"),
    ).toHaveLength(1);
  });

  it("uses the dedicated initial state without demo metrics", () => {
    const data = dashboardFixture();
    data.overview.activity = {
      freshThrough: data.meta.freshThrough,
      points: [],
      status: "empty",
    };
    data.overview.counters.peopleServed = counter(
      "people_served",
      "people",
      0,
      0,
    );
    data.overview.counters.serviceMinutes = counter(
      "service_minutes",
      "minutes",
      0,
      0,
    );
    data.overview.counters.sessionsCompleted = counter(
      "sessions_completed",
      "sessions",
      0,
      0,
    );
    data.sessions.summary.sessionsCompleted =
      data.overview.counters.sessionsCompleted;

    render(<TherapistMetricsPage data={data} />);

    expect(
      screen.getByRole("heading", {
        name: "O que aparecerá com seu histórico",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seus indicadores começam a ser preenchidos conforme o perfil recebe movimento, a agenda é utilizada e as sessões são concluídas.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Demanda por abordagem")).not.toBeInTheDocument();
    expect(screen.queryByText("Avaliações recebidas")).not.toBeInTheDocument();
  });

  it("uses a two-column indicator grid on mobile", () => {
    const { container } = render(
      <TherapistMetricsPage data={dashboardFixture()} />,
    );
    expect(container.querySelector(".grid-cols-2")).toBeInTheDocument();
  });

  it("uses semantic colors across KPIs without generic sparkline tooltips", () => {
    const data = dashboardFixture();
    data.therapist.plan = "premium_plus";
    const { container } = render(<TherapistMetricsPage data={data} />);
    const tones = Array.from(
      container.querySelectorAll<HTMLElement>("article[data-tone]"),
      (card) => card.dataset.tone,
    );

    expect(tones).toEqual(
      expect.arrayContaining(["primary", "mint", "cyan", "warning", "danger"]),
    );
    expect(
      container.querySelectorAll(
        "article[data-tone] .recharts-tooltip-wrapper",
      ),
    ).toHaveLength(0);
    expect(screen.queryByText("Valor")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Total de pessoas acompanhadas no período",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total único no período")).toBeInTheDocument();
  });

  it("keeps the evolution chart visible when the period has no completed sessions", () => {
    const data = dashboardFixture();
    data.overview.activity = {
      freshThrough: data.meta.freshThrough,
      points: [],
      status: "empty",
    };

    render(<TherapistMetricsPage data={data} />);

    expect(
      screen.getByRole("img", {
        name: "Evolução diária das sessões concluídas: ainda sem dados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "O gráfico será preenchido conforme as sessões forem concluídas no período.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps period and CSV actions in an accessible utility bar", () => {
    render(<TherapistMetricsPage data={dashboardFixture()} />);

    expect(
      screen.getByRole("region", { name: "Controles do período" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Período das métricas")).toHaveValue("30");
    expect(
      screen.getByRole("link", { name: "Baixar relatório em CSV" }),
    ).toHaveAttribute(
      "href",
      "/api/therapist/metrics/export?tab=overview&period=30",
    );
  });

  it("distinguishes an infrastructure error", () => {
    render(
      <TherapistMetricsErrorState message="Não foi possível consultar suas métricas agora." />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Acompanhamento indisponível",
      }),
    ).toBeInTheDocument();
  });
});

function dashboardFixture(): TherapistMetricsDashboard {
  const meta = {
    computedAt: "2026-07-28T16:00:00.000Z",
    freshThrough: "2026-07-28T03:00:00.000Z",
    periodDays: 30 as const,
    periodEnd: "2026-07-28T03:00:00.000Z",
    periodStart: "2026-06-28T03:00:00.000Z",
    previousPeriodEnd: "2026-06-28T03:00:00.000Z",
    previousPeriodStart: "2026-05-29T03:00:00.000Z",
    timezone: "America/Sao_Paulo",
  };
  const therapist = {
    plan: "premium" as const,
    profileId: "c1000000-0000-4000-8000-000000000001",
  };
  const sessionsCompleted = counter("sessions_completed", "sessions", 10, 8);
  const overview = {
    activity: {
      freshThrough: meta.freshThrough,
      points: [
        { date: "2026-07-26", sessionsCompleted: 1 },
        { date: "2026-07-27", sessionsCompleted: 2 },
      ],
      status: "ready" as const,
    },
    contractVersion: 1 as const,
    counters: {
      peopleServed: counter("people_served", "people", 8, 6),
      serviceMinutes: counter("service_minutes", "minutes", 390, 420),
      sessionsCompleted,
    },
    discovery: {
      freshThrough: null,
      funnel: {
        profileToBooking: locked("percent"),
        searchToProfile: locked("percent"),
      },
      reason: "privacy_activation_pending" as const,
      stages: {
        bookingFlowStarts: eventCounter("booking_flow_starts"),
        profileViews: eventCounter("profile_views"),
        searchImpressions: eventCounter("search_impressions"),
      },
      status: "unavailable" as const,
    },
    meta,
    metricDefinitionVersion: 1 as const,
    occupancy: {
      reason: "historical_availability_not_versioned" as const,
      status: "unavailable" as const,
    },
    profileFavorites: locked("favorites"),
    therapist,
    therapyRanking: {
      items: [],
      minimumSample: 10 as const,
      observedSample: 3,
      status: "insufficient_sample" as const,
    },
  };

  return {
    contractVersion: 2,
    interest: {
      access: { requiredPlan: "premium_plus", status: "capability_locked" },
      contractVersion: 1,
      meta,
      metricDefinitionVersion: 1,
      therapist,
    },
    meta,
    metricDefinitionVersion: 2,
    occupancy: {
      coverageDays: 4,
      coverageStart: "2026-07-24",
      reason: "history_in_formation",
      requiredCoverageDays: 30,
      status: "forming",
    },
    overview,
    sessions: {
      cancellationReasons: {
        reason: "cancellation_taxonomy_not_versioned",
        status: "unavailable",
      },
      contractVersion: 1,
      evolution: { points: [], status: "empty" },
      heatmap: collection([]),
      meta,
      metricDefinitionVersion: 1,
      outcomeDistribution: collection([]),
      presenceByDay: collection([]),
      presenceByHour: collection([]),
      summary: {
        operationalPresence: locked("percent"),
        reservedDurationAverage: counter(
          "reserved_duration_average",
          "minutes",
          0,
          0,
        ),
        sessionsCancelled: counter("sessions_cancelled", "sessions", 0, 0),
        sessionsCompleted,
        sessionsRescheduled: counter("sessions_rescheduled", "sessions", 0, 0),
      },
      therapist,
      therapyDistribution: collection([]),
    },
    therapist,
  };
}

function counter<TUnit extends "minutes" | "people" | "sessions">(
  key: string,
  unit: TUnit,
  value: number,
  previousValue: number,
) {
  return {
    direction: "up" as const,
    directionCopyKey: `therapist_metrics.${key}.up` as never,
    previousValue,
    status: value === 0 ? ("empty" as const) : ("ready" as const),
    unit,
    value,
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
function locked<TUnit extends "favorites" | "percent">(unit: TUnit) {
  return {
    direction: null,
    directionCopyKey: null,
    minimumSample: 10,
    observedSample: 0,
    previousValue: null,
    status: "insufficient_sample" as const,
    unit,
    value: null,
  };
}
function collection<T>(items: T[]) {
  return {
    items,
    minimumSample: 10 as const,
    observedSample: 0,
    status: "empty" as const,
  };
}
