import { describe, expect, it } from "vitest";

import {
  mapTherapistReviewReplyResult,
  mapTherapistReviewsPageData,
} from "./therapist-reviews.mappers";

describe("therapist reviews mappers", () => {
  it("maps real review metrics without inventing unavailable trends", () => {
    const data = mapTherapistReviewsPageData(rawPage());

    expect(data.metrics).toMatchObject({
      averageRating: 4.8,
      pendingReplies: 1,
      respondedReviews: 1,
      totalReviews: 2,
    });
    expect(
      data.metricCards.find((metric) => metric.key === "positive"),
    ).toMatchObject({
      value: "100%",
    });
    expect(
      data.metricCards.find((metric) => metric.key === "average")?.trend,
    ).toEqual({
      direction: "flat",
      value: null,
    });
  });

  it("maps replies that are safe to expose in the therapist shell", () => {
    const data = mapTherapistReviewsPageData(rawPage());

    expect(data.reviews[0]).toMatchObject({
      patientInitials: "BL",
      responseStatus: "responded",
      reply: {
        body: "Obrigada por compartilhar sua experiência.",
        status: "published",
      },
    });
    expect(data.reviews[1]).toMatchObject({
      reply: null,
      responseStatus: "pending",
    });
  });

  it("maps the idempotent reply result envelope", () => {
    expect(
      mapTherapistReviewReplyResult({
        idempotentReplay: true,
        page: rawPage(),
      }),
    ).toMatchObject({
      idempotentReplay: true,
      page: {
        metrics: {
          totalReviews: 2,
        },
      },
    });
  });
});

function rawPage() {
  return {
    distribution: [
      { count: 2, rating: 5 },
      { count: 0, rating: 4 },
      { count: 0, rating: 3 },
      { count: 0, rating: 2 },
      { count: 0, rating: 1 },
    ],
    generatedAt: "2026-07-28T16:00:00.000Z",
    metrics: {
      averageRating: 4.8,
      distinctPatients: 2,
      pendingReplies: 1,
      positivePercent: 100,
      positiveReviews: 2,
      respondedReviews: 1,
      totalReviews: 2,
      trends: {
        averageRatingDelta: null,
        positivePercentDelta: null,
        respondedReviewsDelta: 1,
        totalReviewsDelta: null,
      },
    },
    reviews: [
      {
        comment: "Senti acolhimento durante o encontro online.",
        id: "33333333-3333-4333-8333-333333333333",
        patientInitials: "BL",
        patientName: "Beatriz Lima",
        publishedAt: "2026-07-28T12:00:00.000Z",
        publishedLabel: "28 de Jul, 2026",
        rating: 5,
        reply: {
          body: "Obrigada por compartilhar sua experiência.",
          id: "44444444-4444-4444-8444-444444444444",
          publishedAt: "2026-07-28T12:20:00.000Z",
          status: "published",
        },
        responseStatus: "responded",
        serviceTitle: "Reiki online",
        therapyName: "Reiki",
      },
      {
        comment: "A comunicação foi clara.",
        id: "55555555-5555-4555-8555-555555555555",
        patientInitials: "MS",
        patientName: "Marina Souza",
        publishedAt: "2026-07-27T12:00:00.000Z",
        publishedLabel: "27 de Jul, 2026",
        rating: 5,
        reply: null,
        responseStatus: "pending",
        serviceTitle: null,
        therapyName: "Tarô",
      },
    ],
    therapist: {
      plan: "premium",
      profileId: "66666666-6666-4666-8666-666666666666",
      publicName: "Ana Oliveira",
      publicSlug: "ana-oliveira",
    },
  };
}
