export const adminTherapyStatuses = [
  "draft",
  "active",
  "published",
  "inactive",
  "archived",
  "in_review",
  "deprecated",
] as const;

export type AdminTherapyStatus = (typeof adminTherapyStatuses)[number];

export type AdminTherapyCategory = {
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
  sortOrder: number;
};

export type AdminMatchingTheme = {
  id: string;
  imageUrl: string | null;
  name: string;
  slug: string;
  sortOrder: number;
};

export type AdminTherapyImpact = {
  activeServiceCount: number;
  futureBookingCount: number;
  isAvailableForServices: boolean;
  isPubliclyVisible: boolean;
  isVisibleInMatching: boolean;
  publicProfileCount: number;
  serviceCount: number;
  therapistCount: number;
};

export type AdminTherapyPublicContent = {
  approachIconKey: string | null;
  approachLabel: string | null;
  benefits: Array<{
    description: string | null;
    iconKey: string;
    title: string;
  }>;
  complementaryDescription: string | null;
  heroFocalPoint: "center" | "left" | "right";
  heroImageUrl: string | null;
  highlights: Array<{
    iconKey: string;
    title: string;
  }>;
  introduction: string | null;
  safetyNote: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  subtitle: string | null;
  visualThemeKey: "energy" | "oracle" | "systemic";
};

export type AdminTherapy = {
  aliases: string[];
  archivedAt: string | null;
  calendarColorKey: string;
  categoryId: string;
  categoryIsActive: boolean;
  categoryName: string;
  categorySlug: string;
  deprecatedAt: string | null;
  description: string | null;
  hasPublishedMatchWeights: boolean;
  history: Array<{
    actorProfileId: string | null;
    createdAt: string;
    eventType: string;
    id: string;
    reason: string | null;
  }>;
  id: string;
  imageUrl: string | null;
  impact: AdminTherapyImpact;
  isAvailableForServices: boolean;
  isFeatured: boolean;
  isPubliclyVisible: boolean;
  isVisibleInMatching: boolean;
  matchingThemeIds: string[];
  name: string;
  publicContent: AdminTherapyPublicContent;
  publishedAt: string | null;
  replacementTherapyId: string | null;
  shortDescription: string;
  slug: string;
  status: AdminTherapyStatus;
  updatedAt: string;
};

export type AdminTherapyCatalogRequest = {
  createdAt: string;
  decision: string | null;
  description: string | null;
  id: string;
  informedName: string;
  justification: string | null;
  relatedTherapyId: string | null;
  status:
    | "approved"
    | "merged"
    | "needs_information"
    | "rejected"
    | "submitted"
    | "under_review";
};

export type AdminTherapyCatalogRequestDetail = AdminTherapyCatalogRequest & {
  materials: Array<{
    createdAt: string;
    fileName: string;
    fileSizeBytes: number;
    id: string;
    mimeType: string;
  }>;
  submission: Record<string, unknown>;
  suggestedCategoryId: string | null;
  updatedAt: string;
};

export type AdminTherapyCatalogContract = {
  categories: AdminTherapyCategory[];
  contractVersion: 1;
  items: AdminTherapy[];
  matchingThemes: AdminMatchingTheme[];
  requests: AdminTherapyCatalogRequest[];
};

export type AdminTherapyDraftCommand = {
  aliases: string[];
  calendarColorKey: string;
  categoryId: string;
  description: string | null;
  highlights: AdminTherapyPublicContent["highlights"];
  benefits: AdminTherapyPublicContent["benefits"];
  imageUrl: string | null;
  isAvailableForServices: boolean;
  isFeatured: boolean;
  isPubliclyVisible: boolean;
  isVisibleInMatching: boolean;
  themeIds: string[];
  name: string;
  publicContent: Omit<
    AdminTherapyPublicContent,
    "benefits" | "highlights"
  >;
  reason: string;
  shortDescription: string;
  slug: string;
  therapyId?: string;
};

export type AdminTherapyTransition =
  | "archive"
  | "deprecate"
  | "publish"
  | "review"
  | "unpublish";
