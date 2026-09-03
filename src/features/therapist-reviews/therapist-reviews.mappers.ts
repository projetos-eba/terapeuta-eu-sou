import type {
  TherapistReviewItem,
  TherapistReviewReplyResult,
  TherapistReviewsDistributionItem,
  TherapistReviewsMetric,
  TherapistReviewsPageData,
  TherapistReviewTrend,
} from "./therapist-reviews.types";

export function mapTherapistReviewsPageData(
  value: unknown,
): TherapistReviewsPageData {
  const row = record(value);
  const metrics = record(row.metrics);
  const therapist = record(row.therapist);
  const trends = record(metrics.trends);
  const averageRating = nullableNumber(metrics.averageRating);
  const totalReviews = number(metrics.totalReviews);
  const respondedReviews = number(metrics.respondedReviews);
  const positivePercent = nullableNumber(metrics.positivePercent);

  return {
    distribution: array(row.distribution).map(mapDistributionItem),
    generatedAt: string(row.generatedAt),
    metricCards: [
      {
        helper:
          totalReviews > 0
            ? `Baseado em ${totalReviews.toLocaleString("pt-BR")} avaliação${totalReviews === 1 ? "" : "ões"}`
            : "Ainda sem dados publicados",
        key: "average",
        label: "Nota média",
        trend: deltaTrend(nullableNumber(trends.averageRatingDelta)),
        value: averageRating
          ? averageRating.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })
          : "Novo",
      },
      {
        helper: `${number(metrics.distinctPatients).toLocaleString("pt-BR")} paciente${number(metrics.distinctPatients) === 1 ? "" : "s"}`,
        key: "total",
        label: "Total de avaliações",
        trend: deltaTrend(nullableNumber(trends.totalReviewsDelta)),
        value: totalReviews.toLocaleString("pt-BR"),
      },
      {
        helper:
          totalReviews > 0
            ? `${Math.round((respondedReviews / totalReviews) * 100)}% respondidas`
            : "Começaremos após as primeiras avaliações",
        key: "responded",
        label: "Avaliações respondidas",
        trend: deltaTrend(nullableNumber(trends.respondedReviewsDelta)),
        value: respondedReviews.toLocaleString("pt-BR"),
      },
      {
        helper:
          positivePercent === null
            ? "Ainda sem dados suficientes"
            : `${number(metrics.positiveReviews).toLocaleString("pt-BR")} avaliação${number(metrics.positiveReviews) === 1 ? "" : "ões"} positivas`,
        key: "positive",
        label: "Avaliações positivas",
        trend: deltaTrend(nullableNumber(trends.positivePercentDelta)),
        value:
          positivePercent === null
            ? "Sem dados"
            : `${positivePercent.toLocaleString("pt-BR", {
                maximumFractionDigits: 0,
              })}%`,
      },
    ],
    pendingConfirmations: array(row.pendingConfirmations).map((value) => {
      const item = record(value);
      return {
        bookingId: string(item.bookingId),
        dueAt: string(item.dueAt),
        endsAt: string(item.endsAt),
        patientName: string(item.patientName, "Paciente TES"),
        remainingSeconds: number(item.remainingSeconds),
        sessionReference: string(item.sessionReference),
        serviceTitle: nullableString(item.serviceTitle),
        startsAt: string(item.startsAt),
        timezone: string(item.timezone, "America/Sao_Paulo"),
      };
    }),
    privateFeedback: array(row.privateFeedback).map((value) => {
      const item = record(value);
      return {
        authorRole: string(item.authorRole) === "therapist" ? "therapist" : "patient",
        bookingId: string(item.bookingId),
        comment: string(item.comment),
        createdAt: string(item.createdAt),
        id: string(item.id),
        notPerformedReason: nullableString(item.notPerformedReason),
        outcome: string(item.outcome) === "not_performed" ? "not_performed" : "completed",
        patientName: string(item.patientName, "Paciente TES"),
        rating: nullableNumber(item.rating),
        serviceTitle: nullableString(item.serviceTitle),
        startsAt: string(item.startsAt),
      };
    }),
    metrics: {
      averageRating,
      distinctPatients: number(metrics.distinctPatients),
      pendingReplies: number(metrics.pendingReplies),
      positivePercent,
      positiveReviews: number(metrics.positiveReviews),
      respondedReviews,
      totalReviews,
    },
    reviews: array(row.reviews).map(mapReview),
    therapist: {
      plan: plan(therapist.plan),
      profileId: string(therapist.profileId),
      publicName: string(therapist.publicName, "Terapeuta"),
      publicSlug: string(therapist.publicSlug),
    },
  };
}

export function mapTherapistReviewReplyResult(
  value: unknown,
): TherapistReviewReplyResult {
  const row = record(value);

  return {
    idempotentReplay: boolean(row.idempotentReplay),
    page: mapTherapistReviewsPageData(row.page),
  };
}

function mapDistributionItem(value: unknown): TherapistReviewsDistributionItem {
  const row = record(value);
  const rating = number(row.rating);

  return {
    count: number(row.count),
    rating: rating >= 1 && rating <= 5 ? (rating as 1 | 2 | 3 | 4 | 5) : 1,
  };
}

function mapReview(value: unknown): TherapistReviewItem {
  const row = record(value);
  const reply = nullableRecord(row.reply);

  return {
    comment: string(row.comment),
    id: string(row.id),
    patientInitials: string(row.patientInitials, "PT"),
    patientName: string(row.patientName, "Paciente TES"),
    publishedAt: nullableString(row.publishedAt),
    publishedLabel: string(row.publishedLabel, "Experiência compartilhada"),
    rating: clampRating(number(row.rating)),
    reply: reply
      ? {
          body: string(reply.body),
          id: string(reply.id),
          publishedAt: nullableString(reply.publishedAt),
          status: "published",
        }
      : null,
    responseStatus:
      string(row.responseStatus) === "responded" ? "responded" : "pending",
    serviceTitle: nullableString(row.serviceTitle),
    therapyName: nullableString(row.therapyName),
  };
}

function deltaTrend(value: number | null): TherapistReviewTrend {
  if (value === null || value === 0) {
    return { direction: "flat", value };
  }

  return {
    direction: value > 0 ? "up" : "down",
    value: Math.abs(value),
  };
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function boolean(value: unknown) {
  return value === true;
}

function clampRating(value: number) {
  if (value < 1) return 1;
  if (value > 5) return 5;
  return Math.round(value);
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function plan(value: unknown): TherapistReviewsPageData["therapist"]["plan"] {
  if (value === "premium" || value === "premium_plus" || value === "free") {
    return value;
  }
  return "free";
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
