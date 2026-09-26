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

export type AdminDashboardActivityPoint = {
  label: string;
  patients: number;
  professionals: number;
  sessions: number;
};

export type AdminDashboardActivityMetric = {
  current: number;
  previous: number;
};

export type AdminDashboardActivity = {
  metrics: {
    patients: AdminDashboardActivityMetric;
    professionals: AdminDashboardActivityMetric;
    sessions: AdminDashboardActivityMetric;
  };
  periodLabel: string;
  series: AdminDashboardActivityPoint[];
  status: "available" | "unavailable";
};

export type AdminDashboardFinancialMetric = {
  currentCents: number;
  previousCents: number;
};

export type AdminDashboardFinancialPoint = {
  grossCommissionCents: number;
  label: string;
  netRevenueCents: number;
  stripeFeesCents: number;
};

export type AdminDashboardFinancialOverview = {
  currency: "BRL";
  feesStatus: "available" | "pending";
  metrics: {
    grossCommission: AdminDashboardFinancialMetric;
    netRevenue: AdminDashboardFinancialMetric;
    stripeFees: AdminDashboardFinancialMetric;
  };
  periodLabel: string;
  series: AdminDashboardFinancialPoint[];
  status: "available" | "unavailable";
};

export type AdminDashboard = {
  activity: AdminDashboardActivity;
  alerts: AdminDashboardAlert[];
  events: AdminDashboardEvent[];
  financial: AdminDashboardFinancialOverview;
  generatedAt: string;
  modules: AdminDashboardModule[];
  summary: AdminDashboardMetric[];
};
