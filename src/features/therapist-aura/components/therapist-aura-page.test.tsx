import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TherapistAuraPageData } from "../therapist-aura.types";
import { TherapistAuraPage } from "./therapist-aura-page";

vi.mock("../therapist-aura.actions", () => ({
  dismissAuraRecommendationAction: vi.fn(),
}));

afterEach(cleanup);

describe("TherapistAuraPage", () => {
  it("keeps the visual composition present when the period has no eligible signals", () => {
    render(<TherapistAuraPage data={emptyFixture()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Aura IA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Seus números mais importantes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recomendações da Aura" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nenhum sinal prioritário agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Insights do período: ainda sem dados" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Em formação").length).toBeGreaterThan(0);
  });
});

function emptyFixture(): TherapistAuraPageData {
  return {
    contractVersion: 1,
    dismissals: [],
    meta: {
      computedAt: "2026-08-23T12:00:00.000Z",
      freshThrough: "2026-08-23T12:00:00.000Z",
      periodDays: 30,
      periodEnd: "2026-08-23T03:00:00.000Z",
      periodStart: "2026-07-24T03:00:00.000Z",
      previousPeriodEnd: "2026-07-24T03:00:00.000Z",
      previousPeriodStart: "2026-06-24T03:00:00.000Z",
      timezone: "America/Sao_Paulo",
    },
    recommendations: [],
    ruleRegistryVersion: 1,
    signals: {
      bookingReadiness: {
        publicBookableServices: 0,
        servicesWithFutureAvailability: 0,
        status: "empty",
        windowDays: 14,
      },
      continuity: {
        returnRate: insufficientRate(),
      },
      reviews: {
        pendingReplyCount: 0,
        status: "empty",
      },
      sessions: {
        cancellationRate: insufficientRate(),
        noShowRate: insufficientRate(),
      },
    },
    therapist: {
      plan: "premium_plus",
      profileId: "c1000000-0000-4000-8000-000000000001",
    },
  };
}

function insufficientRate() {
  return {
    direction: null,
    minimumSample: 10 as const,
    observedSample: 0,
    previousValue: null,
    status: "insufficient_sample" as const,
    unit: "percent" as const,
    value: null,
  };
}
