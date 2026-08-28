import type {
  BioIllustrationId,
  PublicProfileThemeId,
} from "@/features/therapist-profile/types";

export const therapistProfilePublicStatuses = [
  "archived",
  "draft",
  "published",
  "suspended",
  "unpublished",
] as const;

export type TherapistProfilePublicStatus =
  (typeof therapistProfilePublicStatuses)[number];

export type TherapistProfileAccountStatus =
  | "approved"
  | "changes_requested"
  | "draft"
  | "in_review"
  | "rejected"
  | "submitted"
  | "suspended";

export type TherapistProfileVerificationStatus =
  | "approved"
  | "changes_requested"
  | "draft"
  | "in_review"
  | "none"
  | "rejected"
  | "submitted"
  | "suspended";

export type TherapistPrivateDocumentKind =
  | "address_proof"
  | "identity_document";

export type TherapistPrivateDocumentStatus =
  | "accepted"
  | "archived"
  | "rejected"
  | "uploaded";

export type TherapistPrivateDocumentValidationState =
  | "failed"
  | "not_scanned"
  | "passed"
  | "pending";

export type TherapistPrivateDocumentSummary = {
  createdAt: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  kind: TherapistPrivateDocumentKind;
  mimeType: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  status: TherapistPrivateDocumentStatus;
  updatedAt: string;
  validationState: TherapistPrivateDocumentValidationState;
};

export type TherapistProfilePrivateLocation = {
  city: string;
  state: string;
};

export type TherapistProfileVerificationSummary = {
  changesRequested?: string | null;
  id: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  status: TherapistProfileVerificationStatus;
  submittedAt: string | null;
};

export type TherapistProfilePlan = "free" | "premium" | "premium_plus";

export type TherapistProfileEditableFields = {
  bioIllustrationId: BioIllustrationId | null;
  bio: string;
  city: string;
  essenceBody: string;
  experienceYears: number | null;
  guideItems: TherapistProfileGuideItem[];
  headline: string;
  invitationBody: string;
  photoUrl: string;
  publicName: string;
  publicProfileTheme: PublicProfileThemeId;
  reflections: TherapistProfileReflection[];
  shortIntro: string;
  state: string;
  videoProvider: "external" | "upload" | "vimeo" | "youtube";
  videoThumbnailUrl: string;
  videoTitle: string;
  videoUrl: string;
};

export type TherapistProfileGuideItem = {
  icon: string;
  label: string;
};

export type TherapistProfileReflection = {
  excerpt: string;
  href: string;
  imageUrl: string;
  minutesToRead: number;
  title: string;
};

export type TherapistProfileVersionedContent = {
  baseProfileVersion: number | null;
  contentVersionId: string | null;
  fields: TherapistProfileEditableFields;
  publishedAt: string | null;
  status: "draft" | "published";
  updatedAt: string | null;
};

export type TherapistProfileCompleteness = {
  items: Array<{
    complete: boolean;
    key: string;
    label: string;
  }>;
  percent: number;
  score: number;
  total: number;
};

export type TherapistProfileCapabilities = {
  canCustomizePublicSlug: boolean;
  canPublishAdditionalServices: boolean;
  canPublishProfile: boolean;
  canUploadVideo: boolean;
  canUseAdvancedSections: boolean;
  canUseFeaturedMedia: boolean;
};

export type TherapistProfileDerivedData = {
  accountStatus: TherapistProfileAccountStatus;
  activeServiceCount: number;
  availabilityRuleCount: number;
  averageRating: number | null;
  canReceiveBookings: boolean;
  completedSessions: number;
  hasAvailability: boolean;
  plan: TherapistProfilePlan;
  publicStatus: TherapistProfilePublicStatus;
  reviewCount: number;
  startingPriceCents: number | null;
  verificationStatus: TherapistProfileVerificationStatus;
};

export type TherapistProfileEditorData = {
  capabilities: TherapistProfileCapabilities;
  completeness: TherapistProfileCompleteness;
  derived: TherapistProfileDerivedData;
  draft: TherapistProfileVersionedContent | null;
  privateDocuments: TherapistPrivateDocumentSummary[];
  privateLocation?: TherapistProfilePrivateLocation | null;
  propagationNotice: string;
  publicProfileHref: string;
  publicProfileSlug: string;
  publicProfileTheme: PublicProfileThemeId;
  published: TherapistProfileVersionedContent;
  therapistProfileId: string;
  updatedAt: string;
  verificationSummary: TherapistProfileVerificationSummary | null;
  version: number;
};

export type TherapistProfileEditorPayload = Omit<
  TherapistProfileEditableFields,
  | "bio"
  | "city"
  | "essenceBody"
  | "reflections"
  | "headline"
  | "invitationBody"
  | "photoUrl"
  | "shortIntro"
  | "state"
  | "videoThumbnailUrl"
  | "videoTitle"
  | "videoUrl"
> & {
  bio: string | null;
  city: string | null;
  essenceBody: string | null;
  headline: string | null;
  invitationBody: string | null;
  photoUrl: string | null;
  shortIntro: string | null;
  state: string | null;
  videoThumbnailUrl: string | null;
  videoTitle: string | null;
  videoUrl: string | null;
  reflections: Array<{
    excerpt: string | null;
    href: string | null;
    imageUrl: string | null;
    minutesToRead: number;
    title: string;
  }>;
};

export type ReadTherapistProfileCommand = {
  action: "read";
};

export type CheckTherapistProfileSlugCommand = {
  action: "check_slug_availability";
  slug: string;
};

export type UpdateTherapistProfileSlugCommand = {
  action: "update_slug";
  expectedVersion: number;
  requestId: string;
  slug: string;
};

export type SaveTherapistProfileDraftCommand = {
  action: "save_draft";
  expectedVersion: number;
  payload: TherapistProfileEditorPayload;
  preserveLegacyVideoUrl?: true;
  requestId: string;
};

export type SaveTherapistProfileMediaDraftCommand = {
  action: "save_media_draft";
  expectedVersion: number;
  kind: "photo";
  mediaUrl: string;
  requestId: string;
};

export type SimpleTherapistProfileMutationCommand = {
  action: "discard_draft" | "publish" | "unpublish";
  expectedVersion: number;
  requestId: string;
};

export type TherapistProfileCommand =
  | ReadTherapistProfileCommand
  | CheckTherapistProfileSlugCommand
  | SaveTherapistProfileDraftCommand
  | SaveTherapistProfileMediaDraftCommand
  | SimpleTherapistProfileMutationCommand
  | UpdateTherapistProfileSlugCommand;

export type TherapistProfileSlugAvailabilityStatus =
  | "available"
  | "current"
  | "invalid"
  | "reserved"
  | "taken";

export type TherapistProfileSlugAvailabilityResult = {
  normalizedSlug: string;
  status: TherapistProfileSlugAvailabilityStatus;
};

export type TherapistProfileMutationResult = {
  editor: TherapistProfileEditorData;
  idempotentReplay: boolean;
};

export type TherapistProfileErrorCode =
  | "CAPABILITY_NOT_ALLOWED"
  | "FORBIDDEN"
  | "PROFILE_LOCKED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_REQUIREMENTS_INCOMPLETE"
  | "SLUG_INVALID"
  | "SLUG_RESERVED"
  | "SLUG_TAKEN"
  | "UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "VERSION_CONFLICT"
  | "network_error"
  | "unknown";
