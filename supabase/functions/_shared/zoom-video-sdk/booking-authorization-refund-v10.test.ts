import { getAuthorizedVideoBooking } from "./booking-authorization.ts";
import { evaluateVideoSessionAccess } from "./access-policy.ts";

declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

Deno.test("a pending support refund blocks room access for both participants", async () => {
  for (const role of ["patient", "therapist"] as const) {
    let ensured = false;
    const client = {
      get(path: string) {
        if (path.startsWith("/rest/v1/bookings")) return Promise.resolve([{
          id: "b1190000-0000-4000-8000-000000000011",
          version: 1, patient_profile_id: "patient_1", therapist_profile_id: "therapist_1",
          starts_at: "2098-09-14T13:00:00.000Z", ends_at: "2098-09-14T13:50:00.000Z",
          timezone: "America/Sao_Paulo", status: "confirmed",
          therapist_profiles: { status: "approved" },
        }]);
        if (path.startsWith("/rest/v1/session_payments")) return Promise.resolve([{
          financial_status: "paid", refund_pending: true, admin_blocked_at: null,
        }]);
        if (path.startsWith("/rest/v1/video_sessions")) return Promise.resolve([]);
        if (path.startsWith("/rest/v1/booking_events")) return Promise.resolve([]);
        return Promise.resolve([]);
      },
      rpc(name: string) {
        if (name === "ensure_video_session_for_paid_booking_v1") ensured = true;
        return Promise.resolve(true);
      },
    };
    const booking = await getAuthorizedVideoBooking({
      bookingId: "b1190000-0000-4000-8000-000000000011",
      client: client as never, environment: "test", profileId: role === "patient" ? "patient_1" : "therapist_1",
      role,
    });
    if (booking.financialStatus !== "payment_under_review" || ensured) {
      throw new Error("pending refund did not fail closed");
    }
    const access = evaluateVideoSessionAccess({
      actorRole: role, bookingStatus: booking.bookingStatus,
      startsAt: booking.startsAt, endsAt: booking.endsAt,
      financialStatus: booking.financialStatus,
      videoSessionReady: true, videoSessionStatus: "active",
      now: new Date("2098-09-14T13:05:00.000Z"),
      therapistStatus: "approved", therapistProfileEligible: true,
    });
    if (access.allowed) throw new Error("room was available while a refund was pending");
  }
});
