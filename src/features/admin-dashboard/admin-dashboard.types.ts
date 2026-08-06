export type AdminDashboardTone =
  | "danger"
  | "info"
  | "neutral"
  | "success"
  | "warning";

export type AdminDashboardMetric = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "unavailable";
  tone: AdminDashboardTone;
  value: number | null;
};

export type AdminDashboardAlert = {
  description: string;
  href?: string;
  key: string;
  label: string;
  severity: "critical" | "info" | "warning";
};

export type AdminDashboardModule = {
  description: string;
  href?: string;
  key: string;
  label: string;
  metrics: AdminDashboardMetric[];
  status: "degraded" | "pending" | "ready";
};

export type AdminDashboardEvent = {
  actorRole: string;
  createdAt: string;
  entityType: string;
  eventType: string;
  id: string;
  reason: string | null;
};

export type AdminDashboard = {
  alerts: AdminDashboardAlert[];
  events: AdminDashboardEvent[];
  generatedAt: string;
  modules: AdminDashboardModule[];
  summary: AdminDashboardMetric[];
};
