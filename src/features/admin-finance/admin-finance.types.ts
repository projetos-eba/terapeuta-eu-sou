import type { AdminOperationalTone } from "@/features/admin-platform/admin-platform.types";

export type AdminFinanceModuleKey = "payments" | "reports" | "subscriptions";

export type AdminFinanceMetric = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "unavailable";
  tone: AdminOperationalTone;
  value: number | null;
};

export type AdminFinanceField = {
  label: string;
  value: string;
};

export type AdminFinanceRow = {
  fields: AdminFinanceField[];
  id: string;
  statusLabel?: string;
  subtitle?: string;
  title: string;
};

export type AdminFinancePageData = {
  description: string;
  emptyMessage: string;
  generatedAt: string;
  metrics: AdminFinanceMetric[];
  rows: AdminFinanceRow[];
  rowsStatus: "available" | "unavailable";
  rowsTitle: string;
  rowsUnavailableMessage?: string;
  safetyNotes: string[];
  sourceLabel: string;
  title: string;
};

export type AdminFinancePageResult =
  | {
      data: AdminFinancePageData;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };
