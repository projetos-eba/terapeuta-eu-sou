export type ReservationStep = "momento" | "preparar" | "pagamento";

export type ReservationPatientSummary = {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  timezone: string;
};

export type PatientScheduleCheckStatus =
  | "available"
  | "not_applicable"
  | "unavailable";

export type PatientScheduleInterval = {
  endsAt: string;
  startsAt: string;
};

export type ReservationContext = {
  canPrepareEncounter: boolean;
  currentPath: string;
  durationMinutes: number | null;
  hasRequiredCheckoutData: boolean;
  isPatientAuthenticated: boolean;
  marketingConsent: boolean;
  nextStepHref: string;
  patient: ReservationPatientSummary | null;
  paymentStepHref: string;
  priceCents: number | null;
  priceLabel: string;
  retryBookingId: string | null;
  patientScheduleIntervals: PatientScheduleInterval[];
  patientScheduleCheckStatus: PatientScheduleCheckStatus;
  prepareStepHref: string;
  selectedSlot: string | null;
  selectedSlotHasPatientConflict: boolean;
  serviceId: string | null;
  serviceLabel: string;
  serviceSummary: string;
  source: string | null;
  step: ReservationStep;
  therapist: {
    avatarUrl: string | null;
    headline: string;
    isVerified: boolean;
    name: string;
    slug: string | null;
  };
  therapySlug: string | null;
  timezone: string;
  time: {
    dateLabel: string;
    dateLongLabel: string;
    timeRangeLabel: string;
  } | null;
};

export type ReservationSchedule = {
  days: ReservationDay[];
  nextHref: string;
  previousHref: string | null;
};

export type ReservationDay = {
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  slots: Array<{
    hasPatientConflict: boolean;
    href: string;
    isSelected: boolean;
    startsAt: string;
    timeLabel: string;
  }>;
};
