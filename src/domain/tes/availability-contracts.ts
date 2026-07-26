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
