import registry from "./legal-registry.json";

export type LegalDocumentStatus =
  | "draft"
  | "legal_review"
  | "approved"
  | "scheduled"
  | "published"
  | "superseded"
  | "withdrawn";

export type LegalDocumentKey =
  | "terms-of-use"
  | "privacy-policy"
  | "cancellation-reschedule-refund-policy";

export type LegalDocument = {
  approvalDate: string | null;
  approver: string | null;
  audience: string[];
  canonicalPath: string | null;
  documentKey: LegalDocumentKey;
  effectiveDate: string | null;
  hash: string | null;
  language: "pt-BR";
  requiresNewAcceptance: boolean;
  sourceFile: string;
  status: LegalDocumentStatus;
  summary: string;
  title: string;
  version: string | null;
};

export type LegalEntityConfig = {
  address: string | null;
  businessName: string | null;
  cnpj: string | null;
  dataController: string | null;
  dataProtectionOfficer: string | null;
  dataProtectionOfficerContact: string | null;
  generalEmail: string | null;
  jurisdictionVenue: string | null;
  lastLegalReview: string | null;
  phone: string | null;
  privacyEmail: string | null;
  securityEmail: string | null;
  supportEmail: string | null;
  supportHours: string | null;
  tradeName: string;
  website: string;
};

type SupportCategory = {
  acknowledgement: string | null;
  categoryKey: string;
  channel: string | null;
  firstResponseTarget: string | null;
  label: string;
  priority: "normal" | "high" | "critical";
  resolutionTarget: string | null;
  retention: string | null;
  status: LegalDocumentStatus;
  supportHours: string | null;
};

export const legalEntity = registry.entity as LegalEntityConfig;
export const legalDocuments = registry.documents as LegalDocument[];
export const supportMatrix = registry.supportMatrix as SupportCategory[];

export function getLegalDocument(documentKey: LegalDocumentKey) {
  return legalDocuments.find(
    (document) => document.documentKey === documentKey,
  );
}

export function isDocumentPublishable(document: LegalDocument | undefined) {
  return Boolean(
    document?.status === "published" &&
    document.version &&
    document.effectiveDate &&
    document.approvalDate &&
    document.approver &&
    document.hash &&
    document.canonicalPath,
  );
}

export function isSupportCategoryPublishable(category: SupportCategory) {
  return Boolean(
    category.status === "published" &&
    category.channel &&
    category.supportHours &&
    category.acknowledgement &&
    category.firstResponseTarget &&
    category.resolutionTarget,
  );
}

export function isSupportMatrixPublishable() {
  return supportMatrix.length > 0 && supportMatrix.every(isSupportCategoryPublishable);
}

export function getLegalReadinessIssues() {
  const issues: string[] = [];
  const requiredEntityFields: Array<keyof LegalEntityConfig> = [
    "businessName",
    "cnpj",
    "address",
    "generalEmail",
    "supportEmail",
    "privacyEmail",
    "supportHours",
    "dataController",
    "jurisdictionVenue",
    "lastLegalReview",
  ];

  for (const field of requiredEntityFields) {
    if (!legalEntity[field]) {
      issues.push(`LEGAL_ENTITY_MISSING:${field}`);
    }
  }

  for (const document of legalDocuments) {
    if (!isDocumentPublishable(document)) {
      issues.push(`LEGAL_DOCUMENT_NOT_PUBLISHABLE:${document.documentKey}`);
    }
  }

  for (const category of supportMatrix) {
    if (!isSupportCategoryPublishable(category)) {
      issues.push(`SUPPORT_CATEGORY_NOT_PUBLISHABLE:${category.categoryKey}`);
    }
  }

  return issues;
}
