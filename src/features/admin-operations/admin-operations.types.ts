import type { AdminOperationalTone } from "@/features/admin-platform/admin-platform.types";
import type {
  AdminListOption,
  AdminListPageInfo,
  AdminListQuery,
} from "@/features/admin-shared/admin-list-query";
import type { AdminProfessionalDocumentReviewData } from "@/features/therapist-private-documents/private-documents.types";

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
  filterOptions: {
    sort: AdminListOption[];
    status: AdminListOption[];
  };
  generatedAt: string;
  metrics: AdminOperationMetric[];
  listHref: string;
  page: AdminListPageInfo;
  query: AdminListQuery;
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

/**
 * Public-safe profile preview used only by the professional detail.
 *
 * This intentionally mirrors the published projection rather than profile
 * drafts. Administrative detail must not become a backdoor to unpublished
 * therapist content.
 */
export type AdminProfessionalPublishedProfile = {
  content: {
    essenceBody: string | null;
    experienceYears: number | null;
    guideItems: Array<{ label: string }>;
    invitationBody: string | null;
    shortIntro: string | null;
  } | null;
  services: Array<{
    description: string | null;
    durationMinutes: number | null;
    priceCents: number | null;
    serviceTitle: string | null;
    therapyName: string | null;
  }> | null;
  status: "available" | "unavailable";
};

export type AdminProfessionalVerificationSummary = {
  reviewedAt: string | null;
  status:
    | "approved"
    | "changes_requested"
    | "draft"
    | "in_review"
    | "none"
    | "rejected"
    | "submitted"
    | "suspended";
  submittedAt: string | null;
};

export type AdminOperationDetailPageData = {
  auditEvents: AdminOperationAuditEvent[];
  backHref: string;
  generatedAt: string;
  id: string;
  module: AdminOperationModuleKey;
  /**
   * Relacionamento usado exclusivamente para navegação e comandos entre
   * Profissionais e Verificações. Nunca é apresentado como dado de interface.
   */
  relatedProfessionalId?: string | null;
  relatedVerificationId?: string | null;
  /** Indica se a publicação administrativa pode ser solicitada agora. */
  canPublish?: boolean;
  privateDocuments?: AdminProfessionalDocumentReviewData | null;
  safetyNotes: string[];
  sections: AdminOperationDetailSection[];
  statusLabel?: string;
  subtitle?: string;
  title: string;
  publicProfile?: AdminProfessionalPublishedProfile;
  verificationSummary?: AdminProfessionalVerificationSummary | null;
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
