import type {
  BookingStatus,
  MatchSource,
  MessageContext,
  PaymentStatus,
  ReviewStatus,
  ServiceStatus,
  TherapistPlan,
  TherapistStatus,
  TherapyStatus,
  UserRole,
} from "./enums";

export type UUID = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type ISOTimeString = string;
export type CurrencyCode = "BRL" | "USD" | string;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface TimestampedRecord {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface PatientProfile extends TimestampedRecord {
  id: UUID;
  userId: UUID;
  displayName: string;
  avatarUrl?: string;
  birthDate?: ISODateString;
  phone?: string;
  timezone: string;
  marketingConsent: boolean;
  sensitiveDataConsentAt?: ISODateTimeString;
  metadata?: Record<string, JsonValue>;
}

export interface TherapistProfile extends TimestampedRecord {
  id: UUID;
  userId: UUID;
  plan: TherapistPlan;
  status: TherapistStatus;
  slug: string;
  publicName: string;
  legalName?: string;
  headline?: string;
  bio?: string;
  photoUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  languages: string[];
  isPublic: boolean;
  isAcceptingBookings: boolean;
  acceptsOnlineSessions: boolean;
  visibilityFlags?: Record<string, boolean>;
  metadata?: Record<string, JsonValue>;
}

export interface TherapyCategory extends TimestampedRecord {
  id: UUID;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TherapyTheme extends TimestampedRecord {
  id: UUID;
  name: string;
  slug: string;
  description?: string;
  parentThemeId?: UUID;
  isActive: boolean;
}

export interface Therapy extends TimestampedRecord {
  id: UUID;
  categoryId: UUID;
  name: string;
  slug: string;
  shortDescription: string;
  description?: string;
  status: TherapyStatus;
  isFeatured: boolean;
  safetyNote?: string;
  metadata?: Record<string, JsonValue>;
}

export interface TherapistService extends TimestampedRecord {
  id: UUID;
  therapistProfileId: UUID;
  therapyId: UUID;
  title: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  currency: CurrencyCode;
  status: ServiceStatus;
  onlineOnly: boolean;
}

export interface AvailabilityRule extends TimestampedRecord {
  id: UUID;
  therapistProfileId: UUID;
  serviceId?: UUID;
  weekday: Weekday;
  startTime: ISOTimeString;
  endTime: ISOTimeString;
  timezone: string;
  isActive: boolean;
}

export interface AvailabilityException extends TimestampedRecord {
  id: UUID;
  therapistProfileId: UUID;
  serviceId?: UUID;
  startsAt: ISODateTimeString;
  endsAt: ISODateTimeString;
  isAvailable: boolean;
  reason?: string;
}

export interface Booking extends TimestampedRecord {
  id: UUID;
  patientProfileId: UUID;
  therapistProfileId: UUID;
  serviceId: UUID;
  startsAt: ISODateTimeString;
  endsAt: ISODateTimeString;
  timezone: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  meetingUrl?: string;
  meetingProvider?: "zoom" | "other";
  cancellationReason?: string;
  cancelledAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
}

export interface PreCheckoutIntake extends TimestampedRecord {
  id: UUID;
  bookingId?: UUID;
  patientProfileId?: UUID;
  serviceId?: UUID;
  objective: string;
  expectation?: string;
  initialContext?: string;
  sensitiveDataAcknowledged: boolean;
  consentAcceptedAt?: ISODateTimeString;
}

export interface PaymentRecord extends TimestampedRecord {
  id: UUID;
  bookingId: UUID;
  patientProfileId: UUID;
  therapistProfileId: UUID;
  provider: "stripe";
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  amountCents: number;
  platformFeeCents: number;
  therapistAmountCents: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  paidAt?: ISODateTimeString;
  refundedAt?: ISODateTimeString;
}

export interface FavoriteTherapist {
  id: UUID;
  patientProfileId: UUID;
  therapistProfileId: UUID;
  createdAt: ISODateTimeString;
}

export interface Review extends TimestampedRecord {
  id: UUID;
  bookingId: UUID;
  patientProfileId: UUID;
  therapistProfileId: UUID;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  status: ReviewStatus;
  moderationReason?: string;
  publishedAt?: ISODateTimeString;
}

export interface TherapyThemeRelation {
  id?: UUID;
  therapyId: UUID;
  themeId?: UUID;
  subthemeId?: UUID;
  weight: number;
  reason?: string;
  isActive?: boolean;
}

export type MatchableTherapy = Pick<
  Therapy,
  "id" | "name" | "slug" | "shortDescription" | "status"
>;

export interface MatchInput {
  selectedThemeIds: UUID[];
  selectedSubthemeIds?: UUID[];
  relations: TherapyThemeRelation[];
  therapies: MatchableTherapy[];
  source?: MatchSource;
  maxResults?: number;
}

export interface MatchTherapyScore {
  therapy: MatchableTherapy;
  score: number;
  compatibilityPercent: number;
  matchedThemeIds: UUID[];
  matchedSubthemeIds: UUID[];
  explanation: string;
}

export interface MatchResult {
  source: MatchSource;
  results: MatchTherapyScore[];
}

export interface AuraRecommendation extends TimestampedRecord {
  id: UUID;
  title: string;
  body: string;
  sourceRuleKey: string;
  planRequired: TherapistPlan;
  context: Record<string, JsonValue>;
  priority: number;
  therapistProfileId?: UUID;
  patientProfileId?: UUID;
  bookingId?: UUID;
  expiresAt?: ISODateTimeString;
  isActive: boolean;
}

export interface StructuredMessage {
  id: UUID;
  context: MessageContext;
  senderProfileId?: UUID;
  patientProfileId?: UUID;
  therapistProfileId?: UUID;
  bookingId?: UUID;
  body: string;
  metadata?: Record<string, JsonValue>;
  createdAt: ISODateTimeString;
}

export interface Profile {
  id: UUID;
  role: UserRole;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
