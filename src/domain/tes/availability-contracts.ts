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
