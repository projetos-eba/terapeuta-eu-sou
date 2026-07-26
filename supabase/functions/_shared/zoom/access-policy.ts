export const ZoomAccessReason = {
  BookingCancelled: "BOOKING_CANCELLED",
  MeetingNotReady: "MEETING_NOT_READY",
  PaymentNotConfirmed: "PAYMENT_NOT_CONFIRMED",
  TherapistNotAllowed: "THERAPIST_NOT_ALLOWED",
  TherapistSuspended: "THERAPIST_SUSPENDED",
  TooEarly: "TOO_EARLY",
  TooLate: "TOO_LATE",
  Unknown: "UNKNOWN",
} as const;

export type ZoomAccessReason =
  (typeof ZoomAccessReason)[keyof typeof ZoomAccessReason];

export type ZoomAccessState = {
  allowed: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  meetingStatus: string;
  reason: ZoomAccessReason | null;
};

export function evaluateZoomAccess(input: {
  actorOwnsBooking: boolean;
  actorRole: "patient" | "therapist";
  bookingStatus: string;
  endsAt: string;
  financialStatus: string | null;
  meetingReady: boolean;
  meetingStatus: string | null;
  nowMs?: number;
  startsAt: string;
  therapistStatus?: string;
}): ZoomAccessState {
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  const availableFromMs = startsAt - 15 * 60_000;
  const availableUntilMs = endsAt + 30 * 60_000;
  const meetingStatus = input.meetingStatus ?? "not_provisioned";
  const base = {
    allowed: false,
    availableFrom: Number.isFinite(availableFromMs)
      ? new Date(availableFromMs).toISOString()
      : null,
    availableUntil: Number.isFinite(availableUntilMs)
      ? new Date(availableUntilMs).toISOString()
      : null,
    meetingStatus,
  };

  if (!input.actorOwnsBooking) {
    return {
      ...base,
      availableFrom: null,
      availableUntil: null,
      reason: ZoomAccessReason.TherapistNotAllowed,
    };
  }

  if (
    input.actorRole === "therapist" &&
    ["rejected", "suspended"].includes(input.therapistStatus ?? "")
  ) {
    return { ...base, reason: ZoomAccessReason.TherapistSuspended };
  }

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { ...base, reason: ZoomAccessReason.Unknown };
  }

  if (
    [
      "cancelled_by_patient",
      "cancelled_by_therapist",
      "no_show_patient",
      "no_show_therapist",
      "refunded",
    ].includes(input.bookingStatus)
  ) {
    return { ...base, reason: ZoomAccessReason.BookingCancelled };
  }

  if (input.financialStatus !== "paid") {
    return { ...base, reason: ZoomAccessReason.PaymentNotConfirmed };
  }

  const now = input.nowMs ?? Date.now();
  if (now < availableFromMs) {
    return { ...base, reason: ZoomAccessReason.TooEarly };
  }
  if (now >= availableUntilMs || ["ended", "canceled"].includes(meetingStatus)) {
    return { ...base, reason: ZoomAccessReason.TooLate };
  }
  if (meetingStatus === "failed") {
    return { ...base, reason: ZoomAccessReason.Unknown };
  }
  if (!input.meetingReady) {
    return { ...base, reason: ZoomAccessReason.MeetingNotReady };
  }

  return { ...base, allowed: true, reason: null };
}

export function getZoomAccessMessage(reason: ZoomAccessReason) {
  const messages: Record<ZoomAccessReason, string> = {
    [ZoomAccessReason.BookingCancelled]:
      "Esta sessão não está disponível para acesso.",
    [ZoomAccessReason.MeetingNotReady]:
      "A sala ainda está em preparação. Tente novamente em instantes.",
    [ZoomAccessReason.PaymentNotConfirmed]:
      "A sala será liberada quando o pagamento estiver confirmado.",
    [ZoomAccessReason.TherapistNotAllowed]:
      "Esta sessão não está disponível para a sua conta.",
    [ZoomAccessReason.TherapistSuspended]:
      "O acesso às salas está bloqueado para este perfil.",
    [ZoomAccessReason.TooEarly]:
      "A sala fica disponível alguns minutos antes do horário.",
    [ZoomAccessReason.TooLate]: "A janela de acesso desta sessão foi encerrada.",
    [ZoomAccessReason.Unknown]:
      "Não foi possível confirmar o acesso à sala agora.",
  };

  return messages[reason];
}
