export const therapistServiceStatuses = [
  "draft",
  "active",
  "paused",
  "requires_review",
  "rejected",
  "archived",
] as const;

export type TherapistServiceStatus = (typeof therapistServiceStatuses)[number];

export const platformTherapyStatuses = [
  "draft",
  "active",
  "in_review",
  "published",
  "deprecated",
  "inactive",
  "archived",
] as const;

export type PlatformTherapyStatus = (typeof platformTherapyStatuses)[number];

export const therapistServiceDeliveryFormats = ["online"] as const;

export type TherapistServiceDeliveryFormat =
  (typeof therapistServiceDeliveryFormats)[number];

export type TherapyCatalogOption = {
  category: {
    id: string;
    name: string;
    slug: string;
  };
  isAvailableForServices: boolean;
  isPubliclyVisible: boolean;
  isVisibleInMatching: boolean;
  imageUrl: string | null;
  matchingThemes: Array<{
    id: string;
    interests: Array<{
      id: string;
      name: string;
      slug: string;
      sortOrder: number;
      themeId: string;
    }>;
    name: string;
    slug: string;
    sortOrder: number;
  }>;
  name: string;
  shortDescription: string;
  slug: string;
  status: PlatformTherapyStatus;
  therapyId: string;
};

export type TherapistServiceSummary = {
  archivedAt: string | null;
  blockingReason: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  currency: "BRL";
  deliveryFormat: TherapistServiceDeliveryFormat;
  description: string | null;
  durationMinutes: number;
  isBookable: boolean;
  isReservable: boolean;
  metrics: {
    bookingCount: number;
    bookingCountDeltaPercent: number | null;
    bookingsLast30Days: number;
  };
  matching: {
    interestIds: string[];
    themeIds: string[];
  };
  onlineOnly: boolean;
  position: number;
  priceCents: number;
  serviceId: string;
  status: TherapistServiceStatus;
  therapy: {
    id: string;
    imageUrl: string | null;
    isAvailableForServices: boolean;
    isPubliclyVisible: boolean;
    name: string;
    slug: string;
    status: PlatformTherapyStatus;
  };
  therapyId: string;
  title: string;
  updatedAt: string;
  version: number;
};

export type CreateTherapistServiceCommand = {
  action: "create";
  currency?: "BRL";
  deliveryFormat?: TherapistServiceDeliveryFormat;
  description?: string | null;
  durationMinutes: number;
  interestIds: string[];
  priceCents: number;
  requestId: string;
  themeIds: string[];
  therapyId: string;
  title: string;
};

export type UpdateTherapistServiceCommand = {
  action: "update";
  currency?: "BRL";
  deliveryFormat?: TherapistServiceDeliveryFormat;
  description?: string | null;
  durationMinutes?: number;
  expectedVersion: number;
  interestIds?: string[];
  isBookable?: boolean;
  priceCents?: number;
  requestId: string;
  serviceId: string;
  themeIds?: string[];
  therapyId?: string;
  title?: string;
};

export type TransitionTherapistServiceCommand = {
  action: "activate" | "archive" | "pause";
  expectedVersion: number;
  requestId: string;
  serviceId: string;
};

export type ReorderTherapistServicesCommand = {
  action: "reorder";
  requestId: string;
  serviceIds: string[];
};

export type ReadTherapistServicesCommand = {
  action: "catalog" | "list";
};

export type TherapistServicesCommand =
  | CreateTherapistServiceCommand
  | ReadTherapistServicesCommand
  | ReorderTherapistServicesCommand
  | TransitionTherapistServiceCommand
  | UpdateTherapistServiceCommand;

export type TherapistServicesContract = {
  contractVersion: 1;
  items: TherapistServiceSummary[];
  plan: "free" | "premium" | "premium_plus";
  serviceLimit: number | null;
  therapistProfileId: string;
};

export type TherapyCatalogContract = {
  contractVersion: 1;
  items: TherapyCatalogOption[];
  plan: "free" | "premium" | "premium_plus";
  serviceLimit: number | null;
  therapistProfileId: string;
};

export type TherapistServiceMutationResult = {
  contractVersion: 1;
  idempotentReplay: boolean;
  service: TherapistServiceSummary;
};

export type TherapistServiceErrorCode =
  | "duplicate_therapy"
  | "idempotency_conflict"
  | "invalid_payload"
  | "not_found"
  | "plan_limit_reached"
  | "therapy_locked"
  | "therapy_not_available"
  | "unauthorized"
  | "version_conflict";
