import type {
  AdminProfessionalDocumentReviewData,
  AdminProfessionalLifecycleStep,
  TherapistDocumentCenterData,
  TherapistPrivateDocumentItem,
  TherapistPrivateDocumentKind,
  TherapistPrivateDocumentStatus,
  TherapistPrivateDocumentValidationState,
  TherapistRegistrationStep,
  TherapistRegistrationStepState,
} from "./private-documents.types";

type UnknownRecord = Record<string, unknown>;

export function mapTherapistDocumentCenterData(
  payload: unknown,
): TherapistDocumentCenterData {
  const value = requiredRecord(payload);

  return {
    documents: mapDocuments(value.documents),
    progress: mapProgress(value.progress),
    summary: mapSummary(value.summary),
    therapistProfileId: requiredString(value.therapistProfileId),
    verificationStatus: requiredString(value.verificationStatus),
  };
}

export function mapAdminProfessionalDocumentReviewData(
  payload: unknown,
): AdminProfessionalDocumentReviewData {
  const value = requiredRecord(payload);
  const summary = requiredRecord(value.summary);
  const timeline = requiredRecord(value.timeline);

  return {
    documents: mapDocuments(value.documents),
    summary: {
      description: requiredString(summary.description),
      hasDocuments: Boolean(summary.hasDocuments),
      title: requiredString(summary.title),
    },
    therapistProfileId: requiredString(value.therapistProfileId),
    timeline: {
      steps: mapLifecycleSteps(timeline.steps),
    },
    verificationStatus: requiredString(value.verificationStatus),
  };
}

function mapProgress(value: unknown) {
  const progress = requiredRecord(value);

  return {
    completedCount: clampCount(progress.completedCount),
    percent: clampPercent(progress.percent),
    steps: mapRegistrationSteps(progress.steps),
    totalCount: clampCount(progress.totalCount),
  };
}

function mapSummary(value: unknown) {
  const summary = requiredRecord(value);

  return {
    description: requiredString(summary.description),
    missingCount: clampCount(summary.missingCount),
    readyForReview: Boolean(summary.readyForReview),
    title: requiredString(summary.title),
    tone: summaryTone(summary.tone),
  };
}

function mapRegistrationSteps(value: unknown): TherapistRegistrationStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((step) => ({
      description: requiredString(step.description),
      detail: optionalString(step.detail),
      key: requiredString(step.key),
      label: requiredString(step.label),
      state: registrationStepState(step.state),
    }));
}

function mapLifecycleSteps(value: unknown): AdminProfessionalLifecycleStep[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((step) => ({
    detail: optionalString(step.detail),
    key: lifecycleStepKey(step.key),
    label: requiredString(step.label),
    state: lifecycleStepState(step.state),
  }));
}

function mapDocuments(value: unknown): TherapistPrivateDocumentItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((document) => ({
    description: requiredString(document.description),
    fileName: optionalString(document.fileName),
    helper: requiredString(document.helper),
    id: optionalString(document.id),
    kind: documentKind(document.kind),
    mimeType: optionalString(document.mimeType),
    reviewNote: optionalString(document.reviewNote),
    reviewedAt: optionalString(document.reviewedAt),
    sizeBytes: optionalNumber(document.sizeBytes),
    status: documentStatus(document.status),
    title: requiredString(document.title),
    uploadedAt: optionalString(document.uploadedAt),
    validationState: validationState(document.validationState),
  }));
}

function requiredRecord(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("INVALID_PRIVATE_DOCUMENTS_PAYLOAD");
  }

  return value;
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("INVALID_PRIVATE_DOCUMENTS_PAYLOAD");
  }

  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 0;
}

function clampCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function documentKind(value: unknown): TherapistPrivateDocumentKind {
  return value === "identity_document" || value === "address_proof"
    ? value
    : "identity_document";
}

function documentStatus(value: unknown): TherapistPrivateDocumentStatus {
  return value === "accepted" ||
    value === "missing" ||
    value === "rejected" ||
    value === "uploaded"
    ? value
    : "missing";
}

function validationState(
  value: unknown,
): TherapistPrivateDocumentValidationState {
  return value === "failed" ||
    value === "not_scanned" ||
    value === "passed" ||
    value === "pending"
    ? value
    : null;
}

function registrationStepState(value: unknown): TherapistRegistrationStepState {
  return value === "blocked" ||
    value === "complete" ||
    value === "current" ||
    value === "pending"
    ? value
    : "pending";
}

function lifecycleStepKey(
  value: unknown,
): AdminProfessionalLifecycleStep["key"] {
  return value === "approved" ||
    value === "bookable" ||
    value === "created" ||
    value === "published" ||
    value === "review"
    ? value
    : "created";
}

function lifecycleStepState(
  value: unknown,
): AdminProfessionalLifecycleStep["state"] {
  return value === "complete" || value === "current" || value === "pending"
    ? value
    : "pending";
}

function summaryTone(
  value: unknown,
): TherapistDocumentCenterData["summary"]["tone"] {
  return value === "attention" || value === "info" || value === "success"
    ? value
    : "info";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
