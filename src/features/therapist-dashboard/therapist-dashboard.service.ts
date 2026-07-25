import "server-only";

import { cache } from "react";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import {
  mapTherapistDashboardResponse,
  mapTherapistRecommendations,
} from "./therapist-dashboard.mappers";
import {
  queryTherapistDashboard,
  queryTherapistRecommendations,
} from "./therapist-dashboard.queries";
import type {
  TherapistDashboardPageData,
  TherapistDashboardQueryInput,
} from "./therapist-dashboard.types";

export const getTherapistDashboardPage = cache(
  async function getTherapistDashboardPage({
    profileId,
    accessToken,
  }: TherapistDashboardQueryInput): Promise<TherapistDashboardPageData> {
    const [dashboard, recommendationResult] = await Promise.all([
      queryTherapistDashboard(accessToken),
      queryRecommendationsSafely(accessToken),
    ]);
    const main = mapTherapistDashboardResponse(dashboard);

    if (main.therapist.profileId !== profileId) {
      throw new TherapistDashboardError("forbidden");
    }

    const recommendations = recommendationResult
      ? mapTherapistRecommendations(recommendationResult)
      : { aura: null, recommendedActions: [] };

    return { ...main, ...recommendations };
  },
);

async function queryRecommendationsSafely(accessToken: string) {
  try {
    return await queryTherapistRecommendations(accessToken);
  } catch {
    console.warn(
      "[therapist-dashboard] Aura recommendations are temporarily unavailable.",
    );
    return null;
  }
}
