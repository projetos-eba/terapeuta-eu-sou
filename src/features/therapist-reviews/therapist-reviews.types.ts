export const therapistReviewFilters = [
  "all",
  "recent",
  "rating",
  "pending",
] as const;

export type TherapistReviewFilter = (typeof therapistReviewFilters)[number];

export type TherapistReviewTrend = {
  direction: "down" | "flat" | "up";
  value: number | null;
};

export type TherapistReviewsMetric = {
  helper: string;
  key: "average" | "positive" | "responded" | "total";
  label: string;
  trend: TherapistReviewTrend;
  value: string;
};

export type TherapistReviewReply = {
  body: string;
  id: string;
  publishedAt: string | null;
  status: "published";
};

export type TherapistReviewItem = {
  comment: string;
  id: string;
  patientInitials: string;
  patientName: string;
  publishedAt: string | null;
  publishedLabel: string;
  rating: number;
  reply: TherapistReviewReply | null;
  responseStatus: "pending" | "responded";
  serviceTitle: string | null;
  therapyName: string | null;
};

export type TherapistReviewsDistributionItem = {
  count: number;
  rating: 1 | 2 | 3 | 4 | 5;
};

export type TherapistReviewsPageData = {
  distribution: TherapistReviewsDistributionItem[];
  generatedAt: string;
  metrics: {
    averageRating: number | null;
    distinctPatients: number;
    pendingReplies: number;
    positivePercent: number | null;
    positiveReviews: number;
    respondedReviews: number;
    totalReviews: number;
  };
  metricCards: TherapistReviewsMetric[];
  reviews: TherapistReviewItem[];
  therapist: {
    plan: "free" | "premium" | "premium_plus";
    profileId: string;
    publicName: string;
    publicSlug: string;
  };
};

export type TherapistReviewReplyCommand = {
  action: "reply";
  body: string;
  requestId: string;
  reviewId: string;
};

export type TherapistReviewReplyResult = {
  idempotentReplay: boolean;
  page: TherapistReviewsPageData;
};
