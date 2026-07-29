import "server-only";

import { cache } from "react";

import {
  mapTherapistInterestMetrics,
  mapTherapistSessionMetrics,
} from "./therapist-metrics.detail-mappers";
import {
  getTherapistMetricsErrorMessage,
  TherapistMetricsError,
} from "./therapist-metrics.errors";
import { mapTherapistMetricsOverview } from "./therapist-metrics.mappers";
import {
  queryTherapistInterestMetrics,
  queryTherapistMetricsOverview,
  queryTherapistSessionMetrics,
} from "./therapist-metrics.queries";
import type {
  TherapistInterestMetrics,
  TherapistMetricsOverview,
  TherapistMetricsPeriodDays,
  TherapistMetricsTab,
  TherapistSessionMetrics,
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
      data: TherapistMetricsOverview;
      status: "success";
      tab: "overview";
    }
  | {
      data: TherapistSessionMetrics;
      status: "success";
      tab: "sessions";
    }
  | {
      data: TherapistInterestMetrics;
      status: "success";
      tab: "interest";
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
        const data = mapTherapistSessionMetrics(
          await queryTherapistSessionMetrics(accessToken, periodDays),
        );
        enforceProfile(data.therapist.profileId, profileId);
        return { data, status: "success", tab };
      }

      if (tab === "interest") {
        const data = mapTherapistInterestMetrics(
          await queryTherapistInterestMetrics(accessToken, periodDays),
        );
        enforceProfile(data.therapist.profileId, profileId);
        return { data, status: "success", tab };
      }

      const data = mapTherapistMetricsOverview(
        await queryTherapistMetricsOverview(accessToken, periodDays),
      );
      enforceProfile(data.therapist.profileId, profileId);
      return { data, status: "success", tab };
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
