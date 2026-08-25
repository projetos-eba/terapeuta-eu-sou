import { afterEach, describe, expect, it, vi } from "vitest";

import { mapPatientEncountersPage } from "./patient-encounters.mappers";

const patient = {
  avatarUrl: null,
  id: "91000000-0000-4000-8000-000000000001",
  name: "Carlos",
  patientProfileId: "91000000-0000-4000-8000-000000000101",
};

const therapist = {
  headline: "Terapeuta Holistica",
  id: "92000000-0000-4000-8000-000000000001",
  photo_url: null,
  public_name: "Ana Oliveira",
};

const service = {
  id: "93000000-0000-4000-8000-000000000001",
  therapy_id: "94000000-0000-4000-8000-000000000001",
  title: "Reiki",
};

const therapy = {
  id: "94000000-0000-4000-8000-000000000001",
  name: "Reiki",
  slug: "reiki",
};

describe("patient encounters mapper", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses canonical payment status before confirming an encounter", () => {
    const booking = createBooking(
      "95000000-0000-4000-8000-000000000001",
      new Date(Date.now() + 48 * 60 * 60 * 1000),
    );

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "pending" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.nextEncounter?.status).toBe("pending_payment");
    expect(result.nextEncounter?.statusLabel).toBe("Pagamento pendente");
    expect(result.nextEncounter?.primaryAction.label).toBe("Ver pagamento");
  });

  it("surfaces pending reschedule requests on active encounters", () => {
    const booking = createBooking(
      "95000000-0000-4000-8000-000000000002",
      new Date(Date.now() + 72 * 60 * 60 * 1000),
    );

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map([
        [booking.id, { booking_id: booking.id, status: "pending" }],
      ]),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "paid" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.nextEncounter?.status).toBe("reschedule_requested");
    expect(result.nextEncounter?.statusLabel).toBe("Reagendamento solicitado");
    expect(result.nextEncounter?.primaryAction.label).toBe(
      "Acompanhar reagendamento",
    );
  });

  it("allows live entry from paid booking window without exposing a meeting url", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T13:45:00.000Z"));

    const booking = createBooking(
      "95000000-0000-4000-8000-000000000003",
      new Date("2026-08-01T14:00:00.000Z"),
    );

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "paid" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.nextEncounter?.status).toBe("live");
    expect(result.nextEncounter?.meetingUrl).toBeNull();
    expect(result.nextEncounter?.primaryAction.label).toBe(
      "Entrar no encontro",
    );
  });

  it("keeps the entry hint aligned to T-15 before the live window starts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T13:44:00.000Z"));

    const booking = createBooking(
      "95000000-0000-4000-8000-000000000005",
      new Date("2026-08-01T14:00:00.000Z"),
    );

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "paid" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.nextEncounter?.status).toBe("confirmed");
    expect(result.nextEncounter?.actionHint).toBe(
      "Acesso à sala liberado 15 minutos antes.",
    );
  });

  it("keeps every active scheduled encounter in upcoming encounters", () => {
    const bookings = Array.from({ length: 5 }, (_, index) =>
      createBooking(
        `95000000-0000-4000-8000-0000000001${index}`,
        new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
      ),
    );

    const result = mapPatientEncountersPage({
      bookings,
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map(),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.upcomingEncounters).toHaveLength(5);
  });

  it("keeps a bounded recent history for the scrollable list", () => {
    const bookings = Array.from({ length: 55 }, (_, index) => {
      const startsAt = new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000);
      return {
        ...createBooking(
          `95000000-0000-4000-8000-0000000002${index}`,
          startsAt,
        ),
        completed_at: startsAt.toISOString(),
        status: "completed",
      };
    });

    const result = mapPatientEncountersPage({
      bookings,
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map(),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.historyEncounters).toHaveLength(50);
  });

  it("keeps cancelled encounters in history with refund-oriented action", () => {
    const booking = {
      ...createBooking(
        "95000000-0000-4000-8000-000000000004",
        new Date(Date.now() - 72 * 60 * 60 * 1000),
      ),
      cancelled_at: new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(),
      status: "cancelled_by_patient",
    };

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "paid" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.historyEncounters).toHaveLength(1);
    expect(result.historyEncounters[0]?.status).toBe("cancelled");
    expect(result.historyEncounters[0]?.primaryAction.label).toBe(
      "Ver reembolso",
    );
  });

  it("formats encounter times in the booking timezone instead of the server timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));

    const booking = createBooking(
      "95000000-0000-4000-8000-000000000006",
      new Date("2026-08-24T12:10:00.000Z"),
    );

    const result = mapPatientEncountersPage({
      bookings: [booking],
      favoriteTherapistsCount: 0,
      patient,
      rescheduleByBookingId: new Map(),
      reviews: [],
      serviceById: new Map([[service.id, service]]),
      sessionPaymentByBookingId: new Map([
        [booking.id, { booking_id: booking.id, financial_status: "paid" }],
      ]),
      summaries: [],
      therapistById: new Map([[therapist.id, therapist]]),
      therapyById: new Map([[therapy.id, therapy]]),
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
    });

    expect(result.nextEncounter?.scheduleLabel).toContain("09:10");
    expect(result.nextEncounter?.scheduleLabel).not.toContain("12:10");
  });
});

function createBooking(id: string, startsAt: Date) {
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  return {
    cancelled_at: null,
    cancellation_reason: null,
    completed_at: null,
    ends_at: endsAt.toISOString(),
    id,
    service_id: service.id,
    starts_at: startsAt.toISOString(),
    status: "confirmed",
    therapist_profile_id: therapist.id,
    timezone: "America/Sao_Paulo",
  };
}
