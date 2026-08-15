export const therapistPrivateDocumentKinds = [
  "identity_document",
  "address_proof",
] as const;

export type TherapistPrivateDocumentKind =
  (typeof therapistPrivateDocumentKinds)[number];

export type TherapistPrivateDocumentStatus =
  | "accepted"
  | "missing"
  | "rejected"
  | "uploaded";

export type TherapistPrivateDocumentValidationState =
  | "failed"
  | "not_scanned"
  | "passed"
  | "pending"
  | null;

export type TherapistPrivateDocumentItem = {
  description: string;
  fileName: string | null;
  helper: string;
  id: string | null;
  kind: TherapistPrivateDocumentKind;
  mimeType: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  sizeBytes: number | null;
  status: TherapistPrivateDocumentStatus;
  title: string;
  uploadedAt: string | null;
  validationState: TherapistPrivateDocumentValidationState;
};

export type TherapistRegistrationStepState =
  | "blocked"
  | "complete"
  | "current"
  | "pending";

export type TherapistRegistrationStep = {
  description: string;
  detail: string | null;
  key: string;
  label: string;
  state: TherapistRegistrationStepState;
};

export type TherapistDocumentCenterSummary = {
  description: string;
  missingCount: number;
  readyForReview: boolean;
  title: string;
  tone: "attention" | "info" | "success";
};

export type TherapistDocumentCenterData = {
  documents: TherapistPrivateDocumentItem[];
  progress: {
    completedCount: number;
    percent: number;
    steps: TherapistRegistrationStep[];
    totalCount: number;
  };
  summary: TherapistDocumentCenterSummary;
  therapistProfileId: string;
  verificationStatus: string;
};

export type AdminProfessionalLifecycleStep = {
  detail: string | null;
  key: "approved" | "bookable" | "created" | "published" | "review";
  label: string;
  state: "complete" | "current" | "pending";
};

export type AdminProfessionalDocumentReviewData = {
  documents: TherapistPrivateDocumentItem[];
  summary: {
    description: string;
    hasDocuments: boolean;
    title: string;
  };
  therapistProfileId: string;
  timeline: {
    steps: AdminProfessionalLifecycleStep[];
  };
  verificationStatus: string;
};
