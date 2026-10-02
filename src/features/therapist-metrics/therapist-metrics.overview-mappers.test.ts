import { describe, expect, it } from "vitest";

import { TherapistMetricsError } from "./therapist-metrics.errors";
import { buildTherapistMetricsCsv } from "./therapist-metrics.export";
import { mapTherapistMetricsOverview } from "./therapist-metrics.mappers";

describe("therapist metrics overview mapper", () => {
  it("maps discriminated states without inventing unavailable values", () => {
    const data = mapTherapistMetricsOverview(rawOverview());

    expect(data.meta.periodDays).toBe(30);
    expect(data.discovery).toMatchObject({
      freshThrough: null,
      reason: "privacy_activation_pending",
      status: "unavailable",
    });
    expect(data.profileFavorites).toEqual({
      direction: null,
      directionCopyKey: null,
      minimumSample: 10,
      observedSample: 2,
      previousValue: null,
      status: "insufficient_sample",
      unit: "favorites",
      value: null,
    });
    expect(data.occupancy).toEqual({
      reason: "historical_availability_not_versioned",
      status: "unavailable",
    });
  });

  it("accepts the extended approved periods", () => {
    const input = rawOverview();
    input.meta.periodDays = 120;

    expect(mapTherapistMetricsOverview(input).meta.periodDays).toBe(120);
  });

  it("maps the additive V2 discovery contract for the 30 and 60-day interface", () => {
    const input = rawOverview();
    input.contractVersion = 2;
    input.metricDefinitionVersion = 2;
    input.meta.periodDays = 60;
    input.discovery.status = "empty";
    input.discovery.reason = null;

    expect(mapTherapistMetricsOverview(input)).toMatchObject({
      contractVersion: 2,
      meta: { periodDays: 60 },
      metricDefinitionVersion: 2,
    });
  });

  it("maps the V3 bilateral-reporting overview contract", () => {
    const input = rawOverview();
    input.contractVersion = 3;
    input.metricDefinitionVersion = 3;

    expect(mapTherapistMetricsOverview(input)).toMatchObject({
      contractVersion: 3,
      metricDefinitionVersion: 3,
    });
  });

  it("maps a ready cohort rate with its directional copy key", () => {
    const input = rawOverview();
    input.discovery.status = "ready";
    input.discovery.reason = null;
    input.discovery.freshThrough = "2026-07-28T02:00:00.000Z";
    input.discovery.funnel.searchToProfile = {
      direction: "up",
      directionCopyKey: "therapist_metrics.search_to_profile.up",
      minimumSample: 10,
      observedSample: 20,
      previousValue: 35,
      status: "ready",
      unit: "percent",
      value: 45.5,
    };

    expect(
      mapTherapistMetricsOverview(input).discovery.funnel.searchToProfile,
    ).toMatchObject({
      direction: "up",
      observedSample: 20,
      status: "ready",
      value: 45.5,
    });
  });

  it("rejects a locked metric that leaks a value", () => {
    const input = rawOverview();
    input.profileFavorites.value = 2;

    expect(() => mapTherapistMetricsOverview(input)).toThrow(
      TherapistMetricsError,
    );
  });

  it("rejects unsupported periods and activity dates", () => {
    const input = rawOverview();
    input.meta.periodDays = 31;
    expect(() => mapTherapistMetricsOverview(input)).toThrow(
      TherapistMetricsError,
    );

    const invalidDate = rawOverview();
    invalidDate.activity.points[0].date = "2026-07-28T00:00:00Z";
    expect(() => mapTherapistMetricsOverview(invalidDate)).toThrow(
      TherapistMetricsError,
    );
  });

  it("exports the overview as a spreadsheet-friendly report without internal metadata", () => {
    const csv = buildTherapistMetricsCsv({
      data: mapTherapistMetricsOverview(rawOverview()),
      generatedAt: new Date("2026-07-28T16:00:00.000Z"),
      tab: "overview",
    });

    expect(csv.startsWith("\ufeffRelatório de métricas\r\n")).toBe(true);
    expect(csv).toContain("Resumo das métricas\r\nMétrica;Valor;Situação");
    expect(csv).toContain("Pessoas atendidas;7;Disponível");
    expect(csv).toContain("Sessões realizadas;7;Disponível");
    expect(csv).toContain("Minutos de atendimento;380;Disponível");
    expect(csv).toContain("Atividade diária");
    expect(csv).toContain(
      "27/07/2026;1;Sem dados suficientes;Sem dados suficientes;Com sessões realizadas",
    );
    expect(csv).toContain("Indicadores complementares");
    expect(csv).toContain("Visualizações do perfil;Sem dados suficientes");
    expect(csv).toContain("Terapias mais realizadas");
    expect(csv).not.toMatch(
      /section;key;label|report_tab|period_days|fresh_through|metric_definition_version|contract_version|privacy_activation_pending/i,
    );
  });
});

function rawOverview() {
  return {
    activity: {
      freshThrough: "2026-07-28T03:00:00.000Z",
      points: [{ date: "2026-07-27", sessionsCompleted: 1 }],
      status: "ready",
    },
    contractVersion: 1,
    counters: {
      peopleServed: counter("people_served", "people", 7, 4, "up"),
      serviceMinutes: counter("service_minutes", "minutes", 380, 200, "up"),
      sessionsCompleted: counter("sessions_completed", "sessions", 7, 4, "up"),
    },
    discovery: {
      freshThrough: null as string | null,
      funnel: {
        profileToBooking: lockedRate(),
        searchToProfile: lockedRate(),
      },
      reason: "privacy_activation_pending" as string | null,
      stages: {
        bookingFlowStarts: counter(
          "booking_flow_starts",
          "events",
          0,
          0,
          "stable",
        ),
        profileViews: counter("profile_views", "events", 0, 0, "stable"),
        searchImpressions: counter(
          "search_impressions",
          "events",
          0,
          0,
          "stable",
        ),
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
      observedSample: 2,
      previousValue: null,
      status: "insufficient_sample",
      unit: "favorites",
      value: null as number | null,
    },
    therapist: {
      plan: "premium_plus",
      profileId: "c1000000-0000-4000-8000-000000000001",
    },
    therapyRanking: {
      items: [],
      minimumSample: 10,
      observedSample: 7,
      status: "insufficient_sample",
    },
  };
}

function counter(
  key: string,
  unit: string,
  value: number,
  previousValue: number,
  direction: "down" | "stable" | "up",
) {
  return {
    direction,
    directionCopyKey: `therapist_metrics.${key}.${direction}`,
    previousValue,
    status: value === 0 ? "empty" : "ready",
    unit,
    value,
  };
}

function lockedRate(): {
  direction: "down" | "stable" | "up" | null;
  directionCopyKey: string | null;
  minimumSample: number;
  observedSample: number;
  previousValue: number | null;
  status: string;
  unit: string;
  value: number | null;
} {
  return {
    direction: null,
    directionCopyKey: null,
    minimumSample: 10,
    observedSample: 0,
    previousValue: null,
    status: "insufficient_sample",
    unit: "percent",
    value: null,
  };
}
