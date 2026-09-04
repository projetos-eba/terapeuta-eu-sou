import type {
  AttendanceSource,
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  RescheduleStatus,
  SessionFinancialStatus,
  ZoomAccessState,
  ZoomVideoSessionStatus,
} from "@/domain/tes";

export type SessionModality = "online";

export type SessionReadModelItem = {
  attendanceSource: AttendanceSource;
  attendanceStatus: AttendanceStatus;
  bookingId: string;
  sessionReference: string;
  bookingStatus: BookingStatus;
  bookingVersion: number;
  cancellationDecision: string | null;
  cancellationRequiresReview: boolean | null;
  currency: string;
  durationMinutes: number;
  endsAt: string;
  financialStatus: SessionFinancialStatus | null;
  fulfillmentStatus: FulfillmentStatus | null;
  grossAmountCents: number | null;
  videoSessionProvider: string | null;
  videoSessionStatus: ZoomVideoSessionStatus | null;
  modality: SessionModality;
  patientAvatarUrl: string | null;
  patientName: string;
  patientProfileId: string;
  priceCents: number;
  proposedEndsAt: string | null;
  proposedStartsAt: string | null;
  proposedTimezone: string | null;
  refundPending: boolean | null;
  rescheduleStatus: RescheduleStatus | null;
  serviceId: string;
  serviceTitle: string;
  startsAt: string;
  therapistAmountCents: number | null;
  timezone: string;
  transferStatus: string | null;
  zoomAccess: ZoomAccessState;
};

export type TherapistSessionsCursor = {
  bookingId: string;
  startsAt: string;
};

export type TherapistSessionFilters = {
  bookingStatus?: BookingStatus;
  cursor?: TherapistSessionsCursor;
  limit: number;
  modality?: SessionModality;
  patientProfileId?: string;
  periodPreset?: TherapistSessionPeriodPreset;
  periodEnd?: string;
  periodStart?: string;
  serviceId?: string;
};

export type TherapistSessionPeriodPreset = "7" | "30" | "60" | "90" | "all";

export type TherapistSessionsReadModel = {
  filters: {
    bookingStatus: BookingStatus | null;
    financialStatus: SessionFinancialStatus | null;
    modality: SessionModality | null;
    patientProfileId: string | null;
    periodEnd: string | null;
    periodStart: string | null;
    serviceId: string | null;
  };
  items: SessionReadModelItem[];
  summary: TherapistSessionsSummary | null;
  page: {
    hasMore: boolean;
    limit: number;
    nextCursor: TherapistSessionsCursor | null;
  };
  therapistProfileId: string;
  timezone: string;
  version: 1;
};

export type TherapistSessionsSummary = {
  attendanceRate: number | null;
  cancelled: number;
  completed: number;
  pending: number;
  total: number;
};

export type TherapistPendingConfirmationsSummary = {
  generatedAt: string;
  pendingBookingIds: string[];
  pendingSessions: Array<{
    bookingId: string;
    sessionReference: string;
  }>;
  pendingCount: number;
  therapistProfileId: string;
  version: 1;
};

export type TherapistSessionDetailReadModel = SessionReadModelItem & {
  therapistProfileId: string;
  version: 1;
};

export type TherapistAgendaReadModel = {
  availability: {
    exceptions: Array<{
      endsAt: string;
      id: string;
      isAvailable: boolean;
      serviceId: string | null;
      startsAt: string;
    }>;
    rules: Array<{
      dayOfWeek: number;
      endTime: string;
      id: string;
      isActive: boolean;
      serviceId: string;
      startTime: string;
      timezone: string;
    }>;
  };
  bookings: SessionReadModelItem[];
  holds: Array<{
    endsAt: string;
    expiresAt: string;
    id: string;
    serviceId: string;
    serviceTitle: string;
    startsAt: string;
    status: string;
    timezone: string;
  }>;
  range: {
    end: string;
    endExclusive: true;
    start: string;
  };
  summary: {
    activeHolds: number;
    bookings: number;
    pendingReschedules: number;
  };
  therapistProfileId: string;
  timezone: string;
  version: 1;
};

export type TherapistShellCounters = {
  impactedBookings: number;
  pendingPayments: number;
  pendingRescheduleRequests: number;
  pendingReviewReplies: number;
  therapistProfileId: string;
  unreadMessages: number;
  unreadNotifications: number;
  version: 1;
};

export type ReadModelErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "invalid_filter"
  | "not_found"
  | "session_expired"
  | "unavailable";

export type ReadModelResult<T> =
  | { data: T; status: "success" }
  | { data: null; status: "empty" }
  | {
      data: null;
      error: {
        code: ReadModelErrorCode;
        correlationId: string;
        message: string;
      };
      status: "error";
    };

export type SessionActionName =
  | "cancel"
  | "complete"
  | "join_zoom"
  | "register_attendance"
  | "request_reschedule"
  | "review_reschedule"
  | "view_detail"
  | "view_financial";

export type SessionPresentation = {
  actions: {
    canAccessZoom: boolean;
    canCancel: boolean;
    canComplete: boolean;
    canRegisterAttendance: boolean;
    canReschedule: boolean;
    primary: {
      action: SessionActionName;
      label: string;
    };
    secondary: Array<{
      action: SessionActionName;
      label: string;
    }>;
  };
  description: string;
  label: string;
  priority: "critical" | "high" | "low" | "medium";
  state:
    | "cancelled"
    | "confirmed"
    | "in_progress"
    | "payment_pending"
    | "ready"
    | "refunded"
    | "reschedule_requested"
    | "room_preparing"
    | "completed"
    | "requires_attention";
  tone: "danger" | "info" | "neutral" | "success" | "warning";
};
