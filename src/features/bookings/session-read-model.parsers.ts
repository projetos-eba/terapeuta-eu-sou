import {
  AttendanceSource,
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  RescheduleStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
  type ZoomAccessState,
} from "@/domain/tes";

import type {
  SessionModality,
  SessionReadModelItem,
  TherapistAgendaReadModel,
  TherapistPendingConfirmationsSummary,
  TherapistSessionDetailReadModel,
  TherapistSessionsCursor,
  TherapistSessionsReadModel,
  TherapistShellCounters,
} from "./session-read-model.types";

export class SessionReadModelContractError extends Error {
  constructor() {
    super("The Agenda or Sessions read model returned an invalid contract.");
  }
}

export function parseTherapistSessionsReadModel(
  value: unknown,
): TherapistSessionsReadModel {
  const row = requiredRecord(value);
  const page = requiredRecord(row.page);
  const filters = requiredRecord(row.filters);

  return {
    filters: {
      bookingStatus: nullableBookingStatus(filters.bookingStatus),
      financialStatus: nullableFinancialStatus(filters.financialStatus),
      modality: nullableModality(filters.modality),
      patientProfileId: nullableString(filters.patientProfileId),
      periodEnd: nullableString(filters.periodEnd),
      periodStart: nullableString(filters.periodStart),
      serviceId: nullableString(filters.serviceId),
    },
    items: requiredArray(row.items).map(parseSessionReadModelItem),
    summary: nullableSessionsSummary(row.summary),
    page: {
      hasMore: requiredBoolean(page.hasMore),
      limit: requiredNumber(page.limit),
      nextCursor: nullableCursor(page.nextCursor),
    },
    therapistProfileId: requiredString(row.therapistProfileId),
    timezone: requiredString(row.timezone),
    version: version(row.version),
  };
}

function nullableSessionsSummary(
  value: unknown,
): TherapistSessionsReadModel["summary"] {
  if (value === null || value === undefined) return null;
  const row = requiredRecord(value);
  const attendanceRate = row.attendanceRate;

  return {
    attendanceRate:
      attendanceRate === null || attendanceRate === undefined
        ? null
        : requiredNumber(attendanceRate),
    cancelled: requiredNumber(row.cancelled),
    completed: requiredNumber(row.completed),
    pending: requiredNumber(row.pending),
    total: requiredNumber(row.total),
  };
}

export function parseTherapistSessionDetailReadModel(
  value: unknown,
): TherapistSessionDetailReadModel {
  const row = requiredRecord(value);

  return {
    ...parseSessionReadModelItem(row),
    therapistProfileId: requiredString(row.therapistProfileId),
    version: version(row.version),
  };
}

export function parseTherapistAgendaReadModel(
  value: unknown,
): TherapistAgendaReadModel {
  const row = requiredRecord(value);
  const availability = requiredRecord(row.availability);
  const range = requiredRecord(row.range);
  const summary = requiredRecord(row.summary);

  return {
    availability: {
      exceptions: requiredArray(availability.exceptions).map((item) => {
        const exception = requiredRecord(item);
        return {
          endsAt: requiredString(exception.endsAt),
          id: requiredString(exception.id),
          isAvailable: requiredBoolean(exception.isAvailable),
          serviceId: nullableString(exception.serviceId),
          startsAt: requiredString(exception.startsAt),
        };
      }),
      rules: requiredArray(availability.rules).map((item) => {
        const rule = requiredRecord(item);
        return {
          dayOfWeek: requiredNumber(rule.dayOfWeek),
          endTime: requiredString(rule.endTime),
          id: requiredString(rule.id),
          isActive: requiredBoolean(rule.isActive),
          serviceId: requiredString(rule.serviceId),
          startTime: requiredString(rule.startTime),
          timezone: requiredString(rule.timezone),
        };
      }),
    },
    bookings: requiredArray(row.bookings).map(parseSessionReadModelItem),
    holds: requiredArray(row.holds).map((item) => {
      const hold = requiredRecord(item);
      return {
        endsAt: requiredString(hold.endsAt),
        expiresAt: requiredString(hold.expiresAt),
        id: requiredString(hold.id),
        serviceId: requiredString(hold.serviceId),
        serviceTitle: requiredString(hold.serviceTitle),
        startsAt: requiredString(hold.startsAt),
        status: requiredString(hold.status),
        timezone: requiredString(hold.timezone),
      };
    }),
    range: {
      end: requiredString(range.end),
      endExclusive: requiredTrue(range.endExclusive),
      start: requiredString(range.start),
    },
    summary: {
      activeHolds: requiredNumber(summary.activeHolds),
      bookings: requiredNumber(summary.bookings),
      pendingReschedules: requiredNumber(summary.pendingReschedules),
    },
    therapistProfileId: requiredString(row.therapistProfileId),
    timezone: requiredString(row.timezone),
    version: version(row.version),
  };
}

export function parseTherapistShellCounters(
  value: unknown,
): TherapistShellCounters {
  const row = requiredRecord(value);

  return {
    impactedBookings: requiredNumber(row.impactedBookings),
    pendingPayments: requiredNumber(row.pendingPayments),
    pendingRescheduleRequests: requiredNumber(row.pendingRescheduleRequests),
    pendingReviewReplies: requiredNumber(row.pendingReviewReplies),
    therapistProfileId: requiredString(row.therapistProfileId),
    unreadMessages: requiredNumber(row.unreadMessages),
    unreadNotifications: requiredNumber(row.unreadNotifications),
    version: version(row.version),
  };
}

export function parseTherapistPendingConfirmationsSummary(
  value: unknown,
): TherapistPendingConfirmationsSummary {
  const row = requiredRecord(value);
  const pendingBookingIds = requiredArray(row.pendingBookingIds).map(
    requiredString,
  );
  const pendingSessions = requiredArray(row.pendingSessions).map((value) => {
    const session = requiredRecord(value);
    return {
      bookingId: requiredString(session.bookingId),
      sessionReference: requiredString(session.sessionReference),
    };
  });
  const pendingCount = requiredNumber(row.pendingCount);

  if (
    pendingCount !== pendingBookingIds.length ||
    pendingCount !== pendingSessions.length ||
    pendingBookingIds.some(
      (bookingId, index) => pendingSessions[index]?.bookingId !== bookingId,
    )
  ) {
    throw new SessionReadModelContractError();
  }

  return {
    generatedAt: requiredString(row.generatedAt),
    pendingBookingIds,
    pendingSessions,
    pendingCount,
    therapistProfileId: requiredString(row.therapistProfileId),
    version: version(row.version),
  };
}

export function parseSessionReadModelItem(
  value: unknown,
): SessionReadModelItem {
  const row = requiredRecord(value);

  return {
    attendanceSource: attendanceSource(row.attendanceSource),
    attendanceStatus: attendanceStatus(row.attendanceStatus),
    bookingId: requiredString(row.bookingId),
    sessionReference: requiredString(row.sessionReference),
    bookingStatus: bookingStatus(row.bookingStatus),
    bookingVersion: requiredNumber(row.bookingVersion),
    cancellationDecision: nullableString(row.cancellationDecision),
    cancellationRequiresReview: nullableBoolean(row.cancellationRequiresReview),
    currency: requiredString(row.currency),
    durationMinutes: requiredNumber(row.durationMinutes),
    endsAt: requiredString(row.endsAt),
    financialStatus: nullableFinancialStatus(row.financialStatus),
    fulfillmentStatus: nullableFulfillmentStatus(row.fulfillmentStatus),
    grossAmountCents: nullableNumber(row.grossAmountCents),
    videoSessionProvider: nullableString(row.videoSessionProvider),
    videoSessionStatus: nullableZoomVideoSessionStatus(row.videoSessionStatus),
    modality: modality(row.modality),
    patientAvatarUrl: nullableString(row.patientAvatarUrl),
    patientName: requiredString(row.patientName),
    patientProfileId: requiredString(row.patientProfileId),
    priceCents: requiredNumber(row.priceCents),
    proposedEndsAt: nullableString(row.proposedEndsAt),
    proposedStartsAt: nullableString(row.proposedStartsAt),
    proposedTimezone: nullableString(row.proposedTimezone),
    refundPending: nullableBoolean(row.refundPending),
    rescheduleStatus: nullableRescheduleStatus(row.rescheduleStatus),
    serviceId: requiredString(row.serviceId),
    serviceTitle: requiredString(row.serviceTitle),
    startsAt: requiredString(row.startsAt),
    therapistAmountCents: nullableNumber(row.therapistAmountCents),
    timezone: requiredString(row.timezone),
    transferStatus: nullableString(row.transferStatus),
    zoomAccess: zoomAccess(row.zoomAccess),
  };
}

function zoomAccess(value: unknown): ZoomAccessState {
  const row = requiredRecord(value);
  const reason = nullableZoomAccessReason(row.reason);
  const videoSessionStatusValue = requiredString(row.videoSessionStatus);

  if (
    videoSessionStatusValue !== "not_available" &&
    !isZoomVideoSessionStatus(videoSessionStatusValue)
  ) {
    throw new SessionReadModelContractError();
  }

  return {
    allowed: requiredBoolean(row.allowed),
    availableFrom: requiredString(row.availableFrom),
    availableUntil: requiredString(row.availableUntil),
    hardEndsAt: nullableString(row.hardEndsAt),
    scheduledEndsAt: nullableString(row.scheduledEndsAt),
    scheduledStartsAt: nullableString(row.scheduledStartsAt),
    serverNow: nullableString(row.serverNow),
    videoSessionStatus: videoSessionStatusValue,
    reason,
  };
}

function nullableCursor(value: unknown): TherapistSessionsCursor | null {
  if (value === null || value === undefined) return null;
  const row = requiredRecord(value);

  return {
    bookingId: requiredString(row.bookingId),
    startsAt: requiredString(row.startsAt),
  };
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SessionReadModelContractError();
  }

  return value as Record<string, unknown>;
}

function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SessionReadModelContractError();
  return value;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value);
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return requiredNumber(value);
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new SessionReadModelContractError();
  return value;
}

function nullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return requiredBoolean(value);
}

function requiredTrue(value: unknown): true {
  if (value !== true) throw new SessionReadModelContractError();
  return true;
}

function version(value: unknown): 1 {
  if (value !== 1) throw new SessionReadModelContractError();
  return 1;
}

function bookingStatus(value: unknown): BookingStatus {
  if (typeof value !== "string" || !isBookingStatusValue(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableBookingStatus(value: unknown): BookingStatus | null {
  if (value === null || value === undefined) return null;
  return bookingStatus(value);
}

function nullableFinancialStatus(
  value: unknown,
): SessionFinancialStatus | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isFinancialStatus(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableFulfillmentStatus(value: unknown): FulfillmentStatus | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isFulfillmentStatus(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function attendanceStatus(value: unknown): AttendanceStatus {
  if (typeof value !== "string" || !isAttendanceStatus(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function attendanceSource(value: unknown): AttendanceSource {
  if (typeof value !== "string" || !isAttendanceSource(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableRescheduleStatus(value: unknown): RescheduleStatus | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isRescheduleStatus(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function modality(value: unknown): SessionModality {
  if (value !== "online") {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableModality(value: unknown): SessionModality | null {
  if (value === null || value === undefined) return null;
  return modality(value);
}

function nullableZoomVideoSessionStatus(
  value: unknown,
): ZoomVideoSessionStatus | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isZoomVideoSessionStatus(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function nullableZoomAccessReason(value: unknown): ZoomAccessReason | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isZoomAccessReason(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function isBookingStatusValue(value: string): value is BookingStatus {
  return Object.values(BookingStatus).some((candidate) => candidate === value);
}

function isFinancialStatus(value: string): value is SessionFinancialStatus {
  return Object.values(SessionFinancialStatus).some(
    (candidate) => candidate === value,
  );
}

function isFulfillmentStatus(value: string): value is FulfillmentStatus {
  return Object.values(FulfillmentStatus).some(
    (candidate) => candidate === value,
  );
}

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return Object.values(AttendanceStatus).some(
    (candidate) => candidate === value,
  );
}

function isAttendanceSource(value: string): value is AttendanceSource {
  return Object.values(AttendanceSource).some(
    (candidate) => candidate === value,
  );
}

function isRescheduleStatus(value: string): value is RescheduleStatus {
  return Object.values(RescheduleStatus).some(
    (candidate) => candidate === value,
  );
}

function isZoomVideoSessionStatus(
  value: string,
): value is ZoomVideoSessionStatus {
  return Object.values(ZoomVideoSessionStatus).some(
    (candidate) => candidate === value,
  );
}

function isZoomAccessReason(value: string): value is ZoomAccessReason {
  return Object.values(ZoomAccessReason).some(
    (candidate) => candidate === value,
  );
}
