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
  | "rejected"
  | "submitted"
  | "suspended";

export type TherapistProfilePlan = "free" | "premium" | "premium_plus";

export type TherapistProfileEditableFields = {
  bio: string;
  city: string;
  essenceBody: string;
  experienceYears: number | null;
  guideItems: TherapistProfileGuideItem[];
  headline: string;
  invitationBody: string;
  photoUrl: string;
  publicName: string;
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
  propagationNotice: string;
  publicProfileHref: string;
  published: TherapistProfileVersionedContent;
  therapistProfileId: string;
  updatedAt: string;
  version: number;
};

export type TherapistProfileEditorPayload = Omit<
  TherapistProfileEditableFields,
  | "bio"
  | "city"
  | "essenceBody"
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
};

export type ReadTherapistProfileCommand = {
  action: "read";
};

export type SaveTherapistProfileDraftCommand = {
  action: "save_draft";
  expectedVersion: number;
  payload: TherapistProfileEditorPayload;
  requestId: string;
};

export type SimpleTherapistProfileMutationCommand = {
  action: "discard_draft" | "publish" | "unpublish";
  expectedVersion: number;
  requestId: string;
};

export type TherapistProfileCommand =
  | ReadTherapistProfileCommand
  | SaveTherapistProfileDraftCommand
  | SimpleTherapistProfileMutationCommand;

export type TherapistProfileMutationResult = {
  editor: TherapistProfileEditorData;
  idempotentReplay: boolean;
};

export type TherapistProfileErrorCode =
  | "CAPABILITY_NOT_ALLOWED"
  | "FORBIDDEN"
  | "PROFILE_LOCKED"
  | "PROFILE_NOT_FOUND"
  | "UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "VERSION_CONFLICT"
  | "network_error"
  | "unknown";
