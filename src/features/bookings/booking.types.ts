export const bookingStatuses = [
  "draft",
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled_by_patient",
  "cancelled_by_therapist",
  "no_show_patient",
  "no_show_therapist",
  "refunded",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export type BookingPaymentStatus =
  | "not_started"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type BookingPrimaryAction =
  | {
      disabled?: false;
      href: string;
      label: string;
      kind: "link";
    }
  | {
      disabled: true;
      label: string;
      reason: string;
      kind: "button";
    };
