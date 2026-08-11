export { isBookingStatus } from "@/domain/tes";

export const BOOKING_JOIN_WINDOW_BEFORE_MINUTES = 15;
export const BOOKING_JOIN_WINDOW_BEFORE_MS =
  BOOKING_JOIN_WINDOW_BEFORE_MINUTES * 60 * 1000;

export function isActiveBookingStatus(status: string) {
  return status === "confirmed" || status === "pending_payment";
}

export function isCompletedBookingStatus(status: string) {
  return status === "completed";
}

export function isCancelledBookingStatus(status: string) {
  return (
    status === "cancelled_by_patient" ||
    status === "cancelled_by_therapist" ||
    status === "no_show_patient" ||
    status === "no_show_therapist" ||
    status === "refunded"
  );
}

export function canJoinBooking(input: {
  endsAt: string;
  paymentStatus?: string | null;
  startsAt: string;
  status: string;
}) {
  if (input.status !== "confirmed" || input.paymentStatus !== "paid") {
    return false;
  }

  const now = Date.now();
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  const joinWindowStartsAt = startsAt - BOOKING_JOIN_WINDOW_BEFORE_MS;

  return now >= joinWindowStartsAt && now <= endsAt;
}
