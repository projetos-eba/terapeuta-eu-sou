import type { AdminOperationalTone } from "@/features/admin-platform/admin-platform.types";

export type AdminOperationMetric = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "forbidden" | "unavailable";
  tone: AdminOperationalTone;
  value: number | null;
};

export type AdminOperationField = {
  label: string;
  value: string;
};

export type AdminOperationRow = {
  detailHref?: string;
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
  rowsStatus: "available" | "forbidden" | "unavailable";
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

export type AdminOperationAuditEvent = {
  action: string;
  actorRole: string;
  createdAt: string;
  id: string;
  permission: string | null;
  reason: string | null;
  source: string;
};

export type AdminOperationDetailSection = {
  description?: string;
  fields: AdminOperationField[];
  title: string;
};

export type AdminOperationDetailPageData = {
  auditEvents: AdminOperationAuditEvent[];
  backHref: string;
  generatedAt: string;
  id: string;
  module: AdminOperationModuleKey;
  safetyNotes: string[];
  sections: AdminOperationDetailSection[];
  statusLabel?: string;
  subtitle?: string;
  title: string;
};

export type AdminOperationDetailPageResult =
  | {
      data: AdminOperationDetailPageData;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    }
  | {
      status: "not_found";
    };

export type AdminOperationModuleKey =
  | "patients"
  | "professionals"
  | "reviews"
  | "sessions"
  | "support"
  | "verifications";
