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
  pendingConfirmations: TherapistPendingConfirmation[];
  privateFeedback: TherapistPrivateSessionFeedback[];
  reviews: TherapistReviewItem[];
  therapist: {
    plan: "free" | "premium" | "premium_plus";
    profileId: string;
    publicName: string;
    publicSlug: string;
  };
};

export type TherapistPrivateSessionFeedback = {
  authorRole: "patient" | "therapist";
  bookingId: string;
  comment: string;
  createdAt: string;
  id: string;
  notPerformedReason: string | null;
  outcome: "completed" | "not_performed";
  patientName: string;
  rating: number | null;
  serviceTitle: string | null;
  startsAt: string;
};

export type TherapistPendingConfirmation = {
  bookingId: string;
  dueAt: string;
  endsAt: string;
  patientName: string;
  remainingSeconds: number;
  serviceTitle: string | null;
  startsAt: string;
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
