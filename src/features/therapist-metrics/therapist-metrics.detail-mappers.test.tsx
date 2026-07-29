import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistInterestMetricsPage } from "./components/therapist-interest-metrics-page";
import { TherapistSessionMetricsPage } from "./components/therapist-session-metrics-page";
import {
  mapTherapistInterestMetrics,
  mapTherapistSessionMetrics,
} from "./therapist-metrics.detail-mappers";
import { buildTherapistMetricsCsv } from "./therapist-metrics.export";

afterEach(cleanup);

describe("therapist metric detail contracts", () => {
  it("maps the MTR-4 contract without patient identity or free text", () => {
    const mapped = mapTherapistSessionMetrics(sessionPayload());

    expect(mapped.summary.sessionsCompleted.value).toBe(12);
    expect(mapped.summary.operationalPresence).toMatchObject({
      minimumSample: 10,
      status: "ready",
      value: 80,
    });
    expect(mapped.cancellationReasons).toEqual({
      reason: "cancellation_taxonomy_not_versioned",
      status: "unavailable",
    });
    expect(JSON.stringify(mapped)).not.toMatch(
      /patientProfileId|cancellation_reason|reason text/i,
    );
  });

  it("rejects partial values below the minimum sample", () => {
    const payload = sessionPayload();
    payload.outcomeDistribution = {
      items: [
        {
          key: "completed",
          label: "Compareceram",
          percentage: 100,
          value: 2,
        },
      ],
      minimumSample: 10,
      observedSample: 2,
      status: "insufficient_sample",
    };

    expect(() => mapTherapistSessionMetrics(payload)).toThrow();
  });

  it("keeps Premium interest data capability-locked", () => {
    const mapped = mapTherapistInterestMetrics(lockedInterestPayload());

    expect(mapped.access.status).toBe("capability_locked");
    expect("summary" in mapped).toBe(false);
  });

  it("maps protected MTR-5 states without inventing continuity data", () => {
    const mapped = mapTherapistInterestMetrics(readyInterestPayload());

    expect(mapped.access.status).toBe("ready");
    if (!("summary" in mapped)) throw new Error("Unexpected lock.");

    expect(mapped.summary.peopleReturned.status).toBe("insufficient_sample");
    expect(mapped.segments.items).toEqual([]);
    expect(mapped.journeyThemes.reason).toBe("free_text_analysis_prohibited");
  });

  it("exports only aggregate MTR-4 data with version and timezone", () => {
    const mapped = mapTherapistSessionMetrics(sessionPayload());
    const csv = buildTherapistMetricsCsv({
      data: mapped,
      tab: "sessions",
    });

    expect(csv).toContain("metric_definition_version");
    expect(csv).toContain("America/Sao_Paulo");
    expect(csv).toContain("cancellation_taxonomy_not_versioned");
    expect(csv).not.toMatch(/patient_profile_id|patientProfileId|public_name/i);
  });

  it("refuses an Interest export without the Premium Plus capability", () => {
    const mapped = mapTherapistInterestMetrics(lockedInterestPayload());

    expect(() =>
      buildTherapistMetricsCsv({ data: mapped, tab: "interest" }),
    ).toThrow("CAPABILITY_NOT_ALLOWED");
  });

  it("renders the MTR-4 session view with accessible aggregate sections", () => {
    render(
      <TherapistSessionMetricsPage
        data={mapTherapistSessionMetrics(sessionPayload())}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Movimento das sessões" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Presença operacional")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Distribuição por dia e horário",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/textos livres não são analisados/i),
    ).toBeInTheDocument();
  });

  it("renders the plan gate and protected MTR-5 states", () => {
    const { rerender } = render(
      <TherapistInterestMetricsPage
        data={mapTherapistInterestMetrics(lockedInterestPayload())}
      />,
    );

    expect(screen.getByText("Recurso Premium Plus")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /conhecer premium plus/i }),
    ).toHaveAttribute("href", "/terapeuta/plano");

    rerender(
      <TherapistInterestMetricsPage
        data={mapTherapistInterestMetrics(readyInterestPayload())}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Continuidade do acompanhamento",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/mais dados são necessários/i).length).toBe(3);
    expect(
      screen.getByText(/ainda não há dados neste período/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Favoritos que viraram encontro"),
    ).toBeInTheDocument();
  });
});

export function sessionPayload(): Record<string, unknown> {
  return {
    cancellationReasons: {
      reason: "cancellation_taxonomy_not_versioned",
      status: "unavailable",
    },
    contractVersion: 1,
    evolution: {
      points: [
        {
          date: "2026-07-27",
          noShows: 1,
          sessionsCancelled: 2,
          sessionsCompleted: 12,
          sessionsRescheduled: 1,
        },
      ],
      status: "ready",
    },
    heatmap: {
      items: [{ dayOfWeek: 1, hourBucketStart: 18, sessions: 12 }],
      minimumSample: 10,
      observedSample: 12,
      status: "ready",
    },
    meta: meta(),
    metricDefinitionVersion: 1,
    outcomeDistribution: {
      items: [
        {
          key: "completed",
          label: "Compareceram",
          percentage: 80,
          value: 12,
        },
        {
          key: "no_show_patient",
          label: "Ausência da pessoa atendida",
          percentage: 6.7,
          value: 1,
        },
        {
          key: "no_show_therapist",
          label: "Ausência do terapeuta",
          percentage: 0,
          value: 0,
        },
        {
          key: "cancelled_by_patient",
          label: "Canceladas pela pessoa atendida",
          percentage: 13.3,
          value: 2,
        },
        {
          key: "cancelled_by_therapist",
          label: "Canceladas pelo terapeuta",
          percentage: 0,
          value: 0,
        },
      ],
      minimumSample: 10,
      observedSample: 15,
      status: "ready",
    },
    presenceByDay: protectedEmpty(15),
    presenceByHour: protectedEmpty(15),
    summary: {
      operationalPresence: sampledReady(
        "therapist_metrics.operational_presence.up",
        80,
        75,
        "percent",
        15,
      ),
      reservedDurationAverage: counter(
        "therapist_metrics.reserved_duration_average.stable",
        50,
        50,
        "minutes",
      ),
      sessionsCancelled: counter(
        "therapist_metrics.sessions_cancelled.down",
        2,
        3,
        "sessions",
      ),
      sessionsCompleted: counter(
        "therapist_metrics.sessions_completed.up",
        12,
        10,
        "sessions",
      ),
      sessionsRescheduled: counter(
        "therapist_metrics.sessions_rescheduled.stable",
        1,
        1,
        "sessions",
      ),
    },
    therapist: therapist("premium_plus"),
    therapyDistribution: {
      items: [
        {
          percentage: 100,
          sessions: 12,
          therapyId: "therapy-1",
          therapyName: "Reiki",
        },
      ],
      minimumSample: 10,
      observedSample: 12,
      status: "ready",
    },
  };
}

export function readyInterestPayload(): Record<string, unknown> {
  return {
    access: { requiredPlan: "premium_plus", status: "ready" },
    availabilityGap: {
      reason: "availability_gap_event_not_implemented",
      status: "unavailable",
    },
    baseEvolution: protectedEmpty(8),
    cohorts: protectedEmpty(0),
    contractVersion: 1,
    exitReasons: {
      reason: "relationship_exit_taxonomy_not_versioned",
      status: "unavailable",
    },
    favoriteConversion: {
      reason: "favorite_conversion_linkage_not_available",
      status: "unavailable",
    },
    journeyThemes: {
      reason: "free_text_analysis_prohibited",
      status: "unavailable",
    },
    meta: meta(),
    metricDefinitionVersion: 1,
    segments: {
      ...protectedEmpty(8),
      definitionVersion: 1,
    },
    sentiment: {
      reason: "sentiment_schema_and_consent_not_implemented",
      status: "unavailable",
    },
    summary: {
      peopleReturned: sampledInsufficient("people", 8),
      profileFavorites: sampledInsufficient("favorites", 3),
      returnRate: sampledInsufficient("percent", 8),
      sessionsPerPerson: sampledInsufficient("ratio", 8),
    },
    therapist: therapist("premium_plus"),
    therapyReturn: protectedEmpty(8),
  };
}

export function lockedInterestPayload(): Record<string, unknown> {
  return {
    access: {
      requiredPlan: "premium_plus",
      status: "capability_locked",
    },
    contractVersion: 1,
    meta: meta(),
    metricDefinitionVersion: 1,
    therapist: therapist("premium"),
  };
}

function meta() {
  return {
    computedAt: "2026-07-28T16:00:00.000Z",
    freshThrough: "2026-07-28T03:00:00.000Z",
    periodDays: 30,
    periodEnd: "2026-07-28T03:00:00.000Z",
    periodStart: "2026-06-28T03:00:00.000Z",
    previousPeriodEnd: "2026-06-28T03:00:00.000Z",
    previousPeriodStart: "2026-05-29T03:00:00.000Z",
    timezone: "America/Sao_Paulo",
  };
}

function therapist(plan: "premium" | "premium_plus") {
  return {
    plan,
    profileId: "c1000000-0000-4000-8000-000000000001",
  };
}

function counter(
  directionCopyKey: string,
  value: number,
  previousValue: number,
  unit: "minutes" | "sessions",
) {
  return {
    direction: directionCopyKey.endsWith(".up")
      ? "up"
      : directionCopyKey.endsWith(".down")
        ? "down"
        : "stable",
    directionCopyKey,
    previousValue,
    status: value === 0 ? "empty" : "ready",
    unit,
    value,
  };
}

function sampledReady(
  directionCopyKey: string,
  value: number,
  previousValue: number,
  unit: string,
  observedSample: number,
) {
  return {
    direction: directionCopyKey.endsWith(".up") ? "up" : "stable",
    directionCopyKey,
    minimumSample: 10,
    observedSample,
    previousValue,
    status: "ready",
    unit,
    value,
  };
}

function sampledInsufficient(unit: string, observedSample: number) {
  return {
    direction: null,
    directionCopyKey: null,
    minimumSample: 10,
    observedSample,
    previousValue: null,
    status: "insufficient_sample",
    unit,
    value: null,
  };
}

function protectedEmpty(observedSample: number) {
  return {
    items: [],
    minimumSample: 10,
    observedSample,
    status: observedSample === 0 ? "empty" : "insufficient_sample",
  };
}
