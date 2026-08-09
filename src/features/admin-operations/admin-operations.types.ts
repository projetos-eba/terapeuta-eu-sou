import type { AdminOperationalTone } from "@/features/admin-platform/admin-platform.types";

export type AdminOperationMetric = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "unavailable";
  tone: AdminOperationalTone;
  value: number | null;
};

export type AdminOperationField = {
  label: string;
  value: string;
};

export type AdminOperationRow = {
  fields: AdminOperationField[];
  id: string;
  statusLabel?: string;
  subtitle?: string;
  title: string;
};

export type AdminOperationPageData = {
  description: string;
  emptyMessage: string;
  generatedAt: string;
  metrics: AdminOperationMetric[];
  rows: AdminOperationRow[];
  rowsStatus: "available" | "unavailable";
  rowsUnavailableMessage?: string;
  safetyNotes: string[];
  sourceLabel: string;
  title: string;
};

export type AdminOperationPageResult =
  | {
      data: AdminOperationPageData;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };

export type AdminOperationModuleKey =
  | "patients"
  | "professionals"
  | "reviews"
  | "sessions"
  | "support"
  | "verifications";
