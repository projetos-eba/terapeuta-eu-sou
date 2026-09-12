import "server-only";

import { cache } from "react";

import { mapTherapistMetricsDashboard } from "./therapist-metrics.dashboard-mappers";
import {
  mapTherapistInterestMetrics,
  mapTherapistMetricsTodayActivity,
  mapTherapistSessionEvolutionComparison,
  mapTherapistSessionMetrics,
} from "./therapist-metrics.detail-mappers";
import {
  getTherapistMetricsErrorMessage,
  TherapistMetricsError,
} from "./therapist-metrics.errors";
import { mapTherapistMetricsOverview } from "./therapist-metrics.mappers";
import {
  queryTherapistInterestMetrics,
  queryTherapistMetricsDashboard,
  queryTherapistMetricsOverview,
  queryTherapistMetricsTodayActivity,
  queryTherapistSessionEvolutionComparison,
  queryTherapistSessionMetrics,
} from "./therapist-metrics.queries";
import type {
  TherapistInterestMetrics,
  TherapistMetricsDashboardView,
  TherapistMetricsOverview,
  TherapistMetricsPeriodDays,
  TherapistMetricsTab,
  TherapistMetricsTodayActivityState,
  TherapistSessionMetricsView,
} from "./therapist-metrics.types";

export type TherapistMetricsPageResult =
  | {
      data: TherapistMetricsOverview;
      status: "success";
    }
  | {
      code: TherapistMetricsError["code"];
      message: string;
      status: "error";
    };

export const getTherapistMetricsPage = cache(
  async function getTherapistMetricsPage({
    accessToken,
    periodDays,
    profileId,
  }: {
    accessToken: string;
    periodDays: TherapistMetricsPeriodDays;
    profileId: string;
  }): Promise<TherapistMetricsPageResult> {
    try {
      const data = mapTherapistMetricsOverview(
        await queryTherapistMetricsOverview(accessToken, periodDays),
      );

      if (data.therapist.profileId !== profileId) {
        throw new TherapistMetricsError("forbidden");
      }

      return {
        data,
        status: "success",
      };
    } catch (error) {
      const code =
        error instanceof TherapistMetricsError ? error.code : "unavailable";

      return {
        code,
        message: getTherapistMetricsErrorMessage(code),
        status: "error",
      };
    }
  },
);

export type TherapistMetricsViewResult =
  | {
      data: TherapistMetricsDashboardView;
      status: "success";
      tab: "overview";
    }
  | {
      data: TherapistSessionMetricsView;
      status: "success";
      tab: "sessions";
    }
  | {
      data: TherapistInterestMetrics;
      status: "success";
      tab: "interest";
      todayActivity: TherapistMetricsTodayActivityState;
    }
  | {
      code: TherapistMetricsError["code"];
      message: string;
      status: "error";
    };

export const getTherapistMetricsView = cache(
  async function getTherapistMetricsView({
    accessToken,
    periodDays,
    profileId,
    tab,
  }: {
    accessToken: string;
    periodDays: TherapistMetricsPeriodDays;
    profileId: string;
    tab: TherapistMetricsTab;
  }): Promise<TherapistMetricsViewResult> {
    try {
      if (tab === "sessions") {
        const [rawMetrics, rawComparison] = await Promise.all([
          queryTherapistSessionMetrics(accessToken, periodDays),
          queryTherapistSessionEvolutionComparison(accessToken, periodDays),
        ]);
        const data = mapTherapistSessionMetrics(rawMetrics);
        const evolutionComparison =
          mapTherapistSessionEvolutionComparison(rawComparison);
        enforceProfile(data.therapist.profileId, profileId);
        enforceProfile(evolutionComparison.therapist.profileId, profileId);
        return {
          data: { ...data, evolutionComparison },
          status: "success",
          tab,
        };
      }

      if (tab === "interest") {
        const rawMetrics = await queryTherapistInterestMetrics(
          accessToken,
          periodDays,
        );
        const data = mapTherapistInterestMetrics(rawMetrics);
        enforceProfile(data.therapist.profileId, profileId);
        if (data.access.status !== "ready") {
          return {
            data,
            status: "success",
            tab,
            todayActivity: { status: "unavailable" },
          };
        }

        const rawTodayActivity = await queryTodayActivitySafely(accessToken);
        const todayActivity =
          rawTodayActivity === null
            ? ({ status: "unavailable" } as const)
            : mapTherapistMetricsTodayActivity(rawTodayActivity);
        if (todayActivity.status !== "unavailable") {
          enforceProfile(todayActivity.therapist.profileId, profileId);
        }
        return { data, status: "success", tab, todayActivity };
      }

      const [rawDashboard, rawComparison] = await Promise.all([
        queryTherapistMetricsDashboard(accessToken, periodDays),
        queryTherapistSessionEvolutionComparison(accessToken, periodDays),
      ]);
      const data = mapTherapistMetricsDashboard(rawDashboard);
      const sessionEvolutionComparison =
        mapTherapistSessionEvolutionComparison(rawComparison);
      enforceProfile(data.therapist.profileId, profileId);
      enforceProfile(sessionEvolutionComparison.therapist.profileId, profileId);
      return {
        data: { ...data, sessionEvolutionComparison },
        status: "success",
        tab,
      };
    } catch (error) {
      const code =
        error instanceof TherapistMetricsError ? error.code : "unavailable";

      return {
        code,
        message: getTherapistMetricsErrorMessage(code),
        status: "error",
      };
    }
  },
);

function enforceProfile(actualProfileId: string, expectedProfileId: string) {
  if (actualProfileId !== expectedProfileId) {
    throw new TherapistMetricsError("forbidden");
  }
}

async function queryTodayActivitySafely(accessToken: string) {
  try {
    return await queryTherapistMetricsTodayActivity(accessToken);
  } catch (error) {
    if (
      error instanceof TherapistMetricsError &&
      error.code === "unavailable"
    ) {
      return null;
    }
    throw error;
  }
}
