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
    expect(screen.getAllByText("Sessões concluídas").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Pessoas que retornaram").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Taxa de retorno")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ocupação da agenda").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Terapias mais realizadas").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Agenda nos próximos 30 dias")).toBeInTheDocument();
    expect(screen.getByText("Resumo da agenda futura")).toBeInTheDocument();
    expect(
      screen.getByText(/A leitura começa amanhã e considera uma única capacidade/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Frequência de sessões concluídas")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Histórico de 30 dias completos · 28 de jun. – 27 de jul.. Este quadro acompanha o período selecionado, sem incluir hoje.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Veja como as pessoas encontram seu perfil, agendam sessões e se aproximam do seu trabalho. Estas informações ajudam você a entender o que está acontecendo e decidir os próximos passos com mais clareza.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Estamos preparando esta leitura do seu perfil. Uma nova visualização pode levar até um dia para aparecer aqui.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Estamos preparando esta leitura de interesse em agendar. Um novo interesse pode levar até um dia para aparecer aqui.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Até agora, houve 3 sessões concluídas no período. A terapia mais realizada aparece a partir de 10 sessões.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "As informações desta página consideram somente períodos completos e dados agrupados do seu próprio trabalho.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Gerenciar agenda" }),
    ).toHaveAttribute("href", "/terapeuta/agenda");
    expect(screen.getByText("Pessoas atendidas")).toBeInTheDocument();
    expect(
      screen.getAllByText("Terapias mais realizadas").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Caminho até a sessão")).toBeInTheDocument();
    expect(screen.getByText("Como as sessões terminaram")).toBeInTheDocument();
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
      screen.getAllByText(
        "Estamos preparando esta leitura do seu perfil. Uma nova visualização pode levar até um dia para aparecer aqui.",
      ).length,
    ).toBeGreaterThan(0);
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

  it("uses the singular form when one person is attended", () => {
    const data = dashboardFixture();
    data.therapist.plan = "premium_plus";
    data.overview.counters.peopleServed.value = 1;

    render(<TherapistMetricsPage data={data} />);

    expect(screen.getByText("1 pessoa")).toBeInTheDocument();
    expect(screen.queryByText("1 pessoas")).not.toBeInTheDocument();
  });

  it("shows real discovery totals after a complete period has data", () => {
    const data = dashboardFixture();
    data.overview.discovery = {
      ...data.overview.discovery,
      freshThrough: data.meta.freshThrough,
      reason: null,
      stages: {
        bookingFlowStarts: {
          ...data.overview.discovery.stages.bookingFlowStarts,
          direction: "up",
          previousValue: 4,
          status: "ready",
          value: 7,
        },
        profileViews: {
          ...data.overview.discovery.stages.profileViews,
          direction: "up",
          previousValue: 10,
          status: "ready",
          value: 14,
        },
        searchImpressions: {
          ...data.overview.discovery.stages.searchImpressions,
          direction: "up",
          previousValue: 20,
          status: "ready",
          value: 28,
        },
      },
      status: "ready",
    };

    render(<TherapistMetricsPage data={data} />);

    expect(screen.getAllByText("14").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Visualizações em dias concluídos. Uma nova visualização pode levar até um dia para aparecer aqui.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows the initial private session reading and derives idle hours from offered capacity", () => {
    const data = dashboardFixture();
    data.sessions.heatmap = {
      items: [{ dayOfWeek: 0, hourBucketStart: 10, sessions: 7 }],
      observedSample: 7,
      status: "ready",
    };
    data.occupancy = {
      coverageDays: 30,
      coverageStart: "2026-06-28",
      current: {
        occupiedMinutes: 0,
        offeredMinutes: 360,
        percentage: 0,
      },
      heatmap: [
        {
          dayOfWeek: 0,
          hourBucketStart: 8,
          occupiedMinutes: 0,
          offeredMinutes: 120,
          percentage: 0,
        },
        {
          dayOfWeek: 1,
          hourBucketStart: 10,
          occupiedMinutes: 0,
          offeredMinutes: 240,
          percentage: 0,
        },
      ],
      previous: {
        occupiedMinutes: 0,
        offeredMinutes: 360,
        percentage: 0,
      },
      requiredCoverageDays: 30,
      series: [],
      status: "ready",
    };

    render(<TherapistMetricsPage data={data} />);

    expect(
      screen.getByText(
        "Essa leitura vai ficando mais clara conforme novas sessões forem concluídas.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Horas reservadas").parentElement).toHaveTextContent(
      "3h",
    );
  });

  it("keeps session frequency tied to the selected historical period, not the future agenda", () => {
    const data = dashboardFixture();
    data.meta.periodDays = 60;
    data.meta.periodStart = "2026-08-01T03:00:00.000Z";
    data.meta.periodEnd = "2026-09-30T03:00:00.000Z";
    data.sessions.heatmap = {
      items: [{ dayOfWeek: 2, hourBucketStart: 14, sessions: 2 }],
      observedSample: 2,
      status: "ready",
    };
    data.futureAgenda = {
      ...data.futureAgenda!,
      windowEnd: "2026-10-29",
      windowStart: "2026-09-30",
    };

    render(<TherapistMetricsPage data={data} />);

    expect(
      screen.getByText(
        "Histórico de 60 dias completos · 01 de ago. – 29 de set.. Este quadro acompanha o período selecionado, sem incluir hoje.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/30 de set\. – 29 de out\.. A leitura começa amanhã/i),
    ).toBeInTheDocument();
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
    data.futureAgenda = {
      availableMinutes: 0,
      capacityMinutes: 0,
      occupancyRate: null,
      reason: "no_availability",
      reservedMinutes: 0,
      reservedSessionCount: 0,
      status: "insufficient_data",
      windowEnd: "2026-08-26",
      windowStart: "2026-07-28",
    };

    render(<TherapistMetricsPage data={data} />);

    expect(
      screen.getByRole("heading", {
        name: "O que aparecerá com seu histórico",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Essa leitura vai ficando mais clara conforme novas sessões forem concluídas.",
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
        name: /Total de pessoas atendidas no período: Pessoas atendidas, 8/,
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
    expect(screen.getByLabelText("Período das métricas")).toHaveTextContent(
      "30 dias60 dias",
    );
    expect(screen.getByLabelText("Período das métricas")).not.toHaveTextContent(
      "90 dias",
    );
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
    contractVersion: 4,
    futureAgenda: {
      availableMinutes: 420,
      capacityMinutes: 600,
      occupancyRate: 30,
      reason: null,
      reservedMinutes: 180,
      reservedSessionCount: 3,
      status: "available",
      windowEnd: "2026-08-26",
      windowStart: "2026-07-28",
    },
    interest: {
      access: { requiredPlan: "premium_plus", status: "capability_locked" },
      contractVersion: 1,
      meta,
      metricDefinitionVersion: 1,
      therapist,
    },
    meta,
    metricDefinitionVersion: 4,
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
      heatmap: ownHistory([]),
      meta,
      metricDefinitionVersion: 2,
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

function ownHistory<T>(items: T[]) {
  return {
    items,
    observedSample: 0,
    status: "empty" as const,
  };
}
