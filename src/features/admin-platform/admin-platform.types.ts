export type AdminOperationalTone =
  | "danger"
  | "info"
  | "neutral"
  | "success"
  | "warning";

export type AdminOperationalSignal = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "manual" | "unavailable";
  tone: AdminOperationalTone;
  value: number | null;
};

export type AdminOperationalStatus =
  | "configuration_missing"
  | "degraded"
  | "healthy"
  | "manual_review"
  | "unavailable";

export type AdminIntegrationHealth = {
  description: string;
  key: "connect" | "email" | "stripe" | "zoom";
  label: string;
  signals: AdminOperationalSignal[];
  status: AdminOperationalStatus;
};

export type AdminIntegrationsPageData = {
  generatedAt: string;
  integrations: AdminIntegrationHealth[];
  summary: AdminOperationalSignal[];
};

export type AdminSecurityReviewItem = {
  description: string;
  key: string;
  label: string;
  severity: "critical" | "info" | "warning";
  source: string;
  status: AdminOperationalStatus;
};

export type AdminSecurityPageData = {
  auditEvents: Array<{
    actorRole: string;
    createdAt: string;
    entityType: string;
    eventType: string;
    id: string;
    reason: string | null;
  }>;
  generatedAt: string;
  moduleSignals: AdminOperationalSignal[];
  reviewItems: AdminSecurityReviewItem[];
};

export type AdminPlatformPageResult<T> =
  | {
      data: T;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };
