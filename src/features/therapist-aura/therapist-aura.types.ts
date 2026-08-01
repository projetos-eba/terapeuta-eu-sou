export type AuraSignalStatus =
  | "empty"
  | "insufficient_sample"
  | "processing"
  | "ready"
  | "unavailable";

export type AuraActionRouteKey =
  | "agenda"
  | "insights"
  | "profile"
  | "reviews"
  | "services"
  | "sessions";

export type AuraRecommendationTone = "attention" | "care" | "opportunity";

export type AuraSampledRate = {
  direction: "down" | "stable" | "up" | null;
  minimumSample: 10;
  observedSample: number;
  previousValue: number | null;
  status: "insufficient_sample" | "ready";
  unit: "percent";
  value: number | null;
};

export type TherapistAuraSignals = {
  bookingReadiness: {
    publicBookableServices: number;
    servicesWithFutureAvailability: number;
    status: "empty" | "ready";
    windowDays: 14;
  };
  continuity: {
    returnRate: AuraSampledRate;
  };
  reviews: {
    pendingReplyCount: number;
    status: "empty" | "ready";
  };
  sessions: {
    cancellationRate: AuraSampledRate;
    noShowRate: AuraSampledRate;
  };
};

export type TherapistAuraMeta = {
  computedAt: string;
  freshThrough: string;
  periodDays: 30 | 90;
  periodEnd: string;
  periodStart: string;
  previousPeriodEnd: string;
  previousPeriodStart: string;
  timezone: string;
};

export type AuraPersistedRecommendation = {
  actionRouteKey: AuraActionRouteKey | null;
  body: string;
  evidence: Record<string, unknown>;
  expiresAt: string | null;
  generatedAt: string;
  id: string;
  priority: number;
  ruleKey: string;
  ruleVersion: number;
  title: string;
};

export type AuraDismissal = {
  dismissedAt: string;
  periodEnd: string;
  periodStart: string;
  recommendationKey: string;
  ruleKey: string;
  ruleVersion: number;
};

export type AuraRuleRecommendation = {
  actionHref: string;
  actionLabel: string;
  actionRouteKey: AuraActionRouteKey;
  body: string;
  evidenceLabel: string;
  id: string;
  priority: number;
  ruleKey: string;
  ruleVersion: number;
  title: string;
  tone: AuraRecommendationTone;
};

export type TherapistAuraPageData = {
  contractVersion: 1;
  dismissals: AuraDismissal[];
  meta: TherapistAuraMeta;
  recommendations: AuraRuleRecommendation[];
  ruleRegistryVersion: 1;
  signals: TherapistAuraSignals;
  therapist: {
    plan: "premium_plus";
    profileId: string;
  };
};
