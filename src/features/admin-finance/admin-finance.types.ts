import type { AdminOperationalTone } from "@/features/admin-platform/admin-platform.types";
import type {
  AdminListOption,
  AdminListPageInfo,
  AdminListQuery,
} from "@/features/admin-shared/admin-list-query";

export type AdminFinanceModuleKey = "payments" | "reports" | "subscriptions";

export type AdminFinanceMetric = {
  description: string;
  key: string;
  label: string;
  source: string;
  status: "available" | "forbidden" | "unavailable";
  tone: AdminOperationalTone;
  value: number | null;
};

export type AdminFinanceField = {
  label: string;
  value: string;
};

export type AdminFinanceRow = {
  detailHref?: string;
  fields: AdminFinanceField[];
  id: string;
  statusLabel?: string;
  subtitle?: string;
  title: string;
};

export type AdminFinancePageData = {
  description: string;
  emptyMessage: string;
  filterOptions: {
    sort: AdminListOption[];
    status: AdminListOption[];
  };
  generatedAt: string;
  metrics: AdminFinanceMetric[];
  listHref: string;
  page: AdminListPageInfo;
  query: AdminListQuery;
  rows: AdminFinanceRow[];
  rowsStatus: "available" | "forbidden" | "unavailable";
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

export type AdminFinanceEvent = {
  amountLabel?: string;
  createdAt: string;
  id: string;
  kind: string;
  subtitle?: string;
  title: string;
};

export type AdminFinanceDetailSection = {
  description?: string;
  fields: AdminFinanceField[];
  title: string;
};

export type AdminFinanceDetailPageData = {
  backHref: string;
  events: AdminFinanceEvent[];
  generatedAt: string;
  id: string;
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">;
  safetyNotes: string[];
  sections: AdminFinanceDetailSection[];
  statusLabel?: string;
  subtitle?: string;
  title: string;
};

export type AdminFinanceDetailPageResult =
  | {
      data: AdminFinanceDetailPageData;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    }
  | {
      status: "not_found";
    };
