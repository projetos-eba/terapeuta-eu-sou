import { describe, expect, it } from "vitest";

import {
  BookingStatus,
  canTransitionBookingStatus,
  DomainErrorCode,
  isBookingStatus,
  RescheduleStatus,
  TesDomainError,
} from "@/domain/tes";

describe("booking contracts", () => {
  it("uses the canonical BookingStatus catalog", () => {
    expect(isBookingStatus(BookingStatus.Confirmed)).toBe(true);
    expect(isBookingStatus("pending_confirmation")).toBe(false);
  });

  it("allows and rejects explicit status transitions", () => {
    expect(
      canTransitionBookingStatus(
        BookingStatus.PendingPayment,
        BookingStatus.Confirmed,
      ),
    ).toBe(true);
    expect(
      canTransitionBookingStatus(
        BookingStatus.Completed,
        BookingStatus.Confirmed,
      ),
    ).toBe(false);
  });

  it("keeps reschedule terminal states outside BookingStatus", () => {
    expect(RescheduleStatus.Applied).toBe("applied");
    expect(RescheduleStatus.Expired).toBe("expired");
  });

  it("keeps internal and safe error messages separate", () => {
    const error = new TesDomainError(
      DomainErrorCode.BookingConflict,
      "booking constraint bookings_therapist_time_excl failed",
    );

    expect(error.message).toContain("bookings_therapist_time_excl");
    expect(error.safeMessage).not.toContain("constraint");
    expect(error.code).toBe("BOOKING_CONFLICT");
    expect(error.retryable).toBe(true);
  });
});
