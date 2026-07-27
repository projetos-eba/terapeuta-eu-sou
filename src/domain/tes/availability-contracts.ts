import type { ISODateTimeString, UUID } from "./types";
import type { BookingServiceSnapshot } from "./booking-contracts";

export const ScheduleBlockType = {
  AvailableOverride: "available_override",
  Unavailable: "unavailable",
} as const;

export type ScheduleBlockType =
  (typeof ScheduleBlockType)[keyof typeof ScheduleBlockType];

export const BookingHoldStatus = {
  Active: "active",
  Cancelled: "cancelled",
  Consumed: "consumed",
  Expired: "expired",
} as const;

export type BookingHoldStatus =
  (typeof BookingHoldStatus)[keyof typeof BookingHoldStatus];

export type AvailableSlot = {
  endsAt: ISODateTimeString;
  serviceId: UUID;
  startsAt: ISODateTimeString;
};

export type TherapistScheduleRule = {
  dayOfWeek: number;
  endTime: string;
  id: UUID;
  isActive: boolean;
  serviceId: UUID | null;
  startTime: string;
};

export type TherapistServiceScheduleSettings = {
  bookingHorizonDays: number;
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  minimumNoticeMinutes: number;
  slotStepMinutes: number;
};

export type TherapistScheduleService = {
  durationMinutes: number;
  id: UUID;
  settings: TherapistServiceScheduleSettings;
  status: "active" | "archived" | "draft" | "paused";
  title: string;
  weeklyAvailableMinutes: number;
};

export type TherapistScheduleReadModel = {
  contractVersion: 1;
  rules: TherapistScheduleRule[];
  scheduleVersion: number;
  services: TherapistScheduleService[];
  summary: {
    configuredDays: number;
    weeklyAvailableMinutes: number;
  };
  therapistProfileId: UUID;
  timezone: string;
  updatedAt: ISODateTimeString;
};

export type SaveTherapistScheduleInput = {
  expectedVersion: number;
  requestId: UUID;
  rules: Array<Omit<TherapistScheduleRule, "id"> & { id: UUID | null }>;
  serviceSettings: Array<
    TherapistServiceScheduleSettings & {
      serviceId: UUID;
    }
  >;
  timezone: string;
};

export type SaveTherapistScheduleResult = {
  idempotentReplay: boolean;
  scheduleVersion: number;
  timezone: string;
};

export const TherapistBlockReason = {
  Administrative: "administrative",
  Health: "health",
  Other: "other",
  Personal: "personal",
  Training: "training",
  Vacation: "vacation",
} as const;

export type TherapistBlockReason =
  (typeof TherapistBlockReason)[keyof typeof TherapistBlockReason];

export const TherapistBlockRecurrence = {
  Daily: "daily",
  None: "none",
  Weekly: "weekly",
} as const;

export type TherapistBlockRecurrence =
  (typeof TherapistBlockRecurrence)[keyof typeof TherapistBlockRecurrence];

export type TherapistBlockImpact = {
  bookingId: UUID;
  impactId: UUID;
  patientName: string;
  resolution: "keep_booking" | null;
  serviceTitle: string;
  startsAt: ISODateTimeString;
  status: "dismissed" | "pending" | "resolved";
};

export type TherapistBlock = {
  allDay: boolean;
  createdAt: ISODateTimeString;
  endsAt: ISODateTimeString;
  id: UUID;
  impactedBookings: TherapistBlockImpact[];
  reason: string | null;
  reasonCode: TherapistBlockReason;
  recurrenceEndsOn: string | null;
  recurrenceFrequency: TherapistBlockRecurrence;
  seriesId: UUID | null;
  serviceId: UUID | null;
  serviceTitle: string | null;
  startsAt: ISODateTimeString;
  status: "active" | "cancelled";
  timezone: string;
  version: number;
};

export type TherapistBlocksReadModel = {
  blocks: TherapistBlock[];
  contractVersion: 1;
  nextCursor: {
    id: UUID;
    startsAt: ISODateTimeString;
  } | null;
  scheduleVersion: number;
  summary: {
    activeBlocks: number;
    pendingImpacts: number;
    recurringSeries: number;
  };
  therapistProfileId: UUID;
  timezone: string;
};

export type CreateTherapistBlockInput = {
  action: "create";
  allDay: boolean;
  endTime: string | null;
  reason: string | null;
  reasonCode: TherapistBlockReason;
  recurrenceEndsOn: string;
  recurrenceFrequency: TherapistBlockRecurrence;
  requestId: UUID;
  serviceId: UUID | null;
  startTime: string | null;
  startsOn: string;
  timezone: string;
};

export type CancelTherapistBlockInput = {
  action: "cancel";
  blockId: UUID;
  expectedScheduleVersion: number;
  requestId: UUID;
  scope: "occurrence" | "series";
};

export type ResolveTherapistBlockImpactInput = {
  action: "resolve_impact";
  impactId: UUID;
  requestId: UUID;
  resolution: "keep_booking";
};

export type TherapistBlockActionInput =
  | CancelTherapistBlockInput
  | CreateTherapistBlockInput
  | ResolveTherapistBlockImpactInput;

export type TherapistBlockCommandResult = {
  idempotentReplay: boolean;
  impactedBookingCount?: number;
  occurrenceCount?: number;
  scheduleVersion?: number;
  seriesId?: UUID;
};

export type BookingHold = {
  bookingId?: UUID;
  expiresAt: ISODateTimeString;
  id: UUID;
  idempotencyKey: string;
  patientProfileId: UUID;
  snapshot: BookingServiceSnapshot;
  slot: AvailableSlot;
  status: BookingHoldStatus;
  therapistProfileId: UUID;
  version: number;
};

export const AVAILABILITY_PREVIEW_TIMEZONE_LIMITATION =
  "The TypeScript preview evaluates calendar days in the server runtime timezone; booking confirmation must use the future authoritative Postgres slot engine.";
