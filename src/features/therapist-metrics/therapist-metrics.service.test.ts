import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  queryTherapistInterestMetrics: vi.fn(),
  queryTherapistMetricsDashboard: vi.fn(),
  queryTherapistMetricsOverview: vi.fn(),
  queryTherapistMetricsTodayActivity: vi.fn(),
  queryTherapistSessionEvolutionComparison: vi.fn(),
  queryTherapistSessionMetrics: vi.fn(),
}));

const mapperMocks = vi.hoisted(() => ({
  mapTherapistInterestMetrics: vi.fn(),
  mapTherapistMetricsDashboard: vi.fn(),
  mapTherapistMetricsOverview: vi.fn(),
  mapTherapistMetricsTodayActivity: vi.fn(),
  mapTherapistSessionEvolutionComparison: vi.fn(),
  mapTherapistSessionMetrics: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <TFunction extends (...args: never[]) => unknown>(fn: TFunction) => fn,
}));
vi.mock("./therapist-metrics.queries", () => queryMocks);
vi.mock("./therapist-metrics.dashboard-mappers", () => ({
  mapTherapistMetricsDashboard: mapperMocks.mapTherapistMetricsDashboard,
}));
vi.mock("./therapist-metrics.detail-mappers", () => ({
  mapTherapistInterestMetrics: mapperMocks.mapTherapistInterestMetrics,
  mapTherapistMetricsTodayActivity:
    mapperMocks.mapTherapistMetricsTodayActivity,
  mapTherapistSessionEvolutionComparison:
    mapperMocks.mapTherapistSessionEvolutionComparison,
  mapTherapistSessionMetrics: mapperMocks.mapTherapistSessionMetrics,
}));
vi.mock("./therapist-metrics.mappers", () => ({
  mapTherapistMetricsOverview: mapperMocks.mapTherapistMetricsOverview,
}));

import { TherapistMetricsError } from "./therapist-metrics.errors";
import { getTherapistMetricsView } from "./therapist-metrics.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTherapistMetricsView current-day projection", () => {
  it("does not request Premium Plus activity for a capability-locked plan", async () => {
    queryMocks.queryTherapistInterestMetrics.mockResolvedValue({});
    mapperMocks.mapTherapistInterestMetrics.mockReturnValue({
      access: { requiredPlan: "premium_plus", status: "capability_locked" },
      therapist: { plan: "premium", profileId: "profile-premium" },
    });

    const result = await getTherapistMetricsView({
      accessToken: "premium-token",
      periodDays: 30,
      profileId: "profile-premium",
      tab: "interest",
    });

    expect(result).toMatchObject({
      status: "success",
      tab: "interest",
      todayActivity: { status: "unavailable" },
    });
    expect(
      queryMocks.queryTherapistMetricsTodayActivity,
    ).not.toHaveBeenCalled();
  });

  it("keeps historical metrics available when only today's projection fails", async () => {
    queryMocks.queryTherapistInterestMetrics.mockResolvedValue({});
    queryMocks.queryTherapistMetricsTodayActivity.mockRejectedValue(
      new TherapistMetricsError("unavailable"),
    );
    mapperMocks.mapTherapistInterestMetrics.mockReturnValue({
      access: { status: "ready" },
      therapist: { plan: "premium_plus", profileId: "profile-plus" },
    });

    const result = await getTherapistMetricsView({
      accessToken: "plus-token-unavailable",
      periodDays: 30,
      profileId: "profile-plus",
      tab: "interest",
    });

    expect(result).toMatchObject({
      status: "success",
      tab: "interest",
      todayActivity: { status: "unavailable" },
    });
  });

  it("fails closed when the current-day projection belongs to another profile", async () => {
    queryMocks.queryTherapistInterestMetrics.mockResolvedValue({});
    queryMocks.queryTherapistMetricsTodayActivity.mockResolvedValue({});
    mapperMocks.mapTherapistInterestMetrics.mockReturnValue({
      access: { status: "ready" },
      therapist: { plan: "premium_plus", profileId: "profile-plus" },
    });
    mapperMocks.mapTherapistMetricsTodayActivity.mockReturnValue({
      status: "ready",
      therapist: { plan: "premium_plus", profileId: "another-profile" },
    });

    const result = await getTherapistMetricsView({
      accessToken: "plus-token-mismatch",
      periodDays: 30,
      profileId: "profile-plus",
      tab: "interest",
    });

    expect(result).toMatchObject({ code: "forbidden", status: "error" });
  });
});
