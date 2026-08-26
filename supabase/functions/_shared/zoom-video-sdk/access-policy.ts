export const VIDEO_SESSION_ACCESS_WINDOW = {
  beforeStartsMinutes: 15,
  firstPatientJoinAfterStartsMinutes: 10,
} as const;

export type VideoAccessReason =
  | "BOOKING_CANCELLED"
  | "VIDEO_SESSION_NOT_READY"
  | "PAYMENT_NOT_CONFIRMED"
  | "THERAPIST_NOT_ALLOWED"
  | "THERAPIST_NOT_IN_SESSION"
  | "THERAPIST_SUSPENDED"
  | "HARD_TIMEOUT"
  | "TOO_EARLY"
  | "TOO_LATE"
  | "UNKNOWN";

export type VideoAccessState = {
  allowed: boolean;
  availableFrom: string;
  availableUntil: string;
  hardEndsAt: string | null;
  scheduledEndsAt: string;
  scheduledStartsAt: string;
  videoSessionStatus: string;
  reason: VideoAccessReason | null;
  serverNow: string;
};

export function evaluateVideoSessionAccess(input: {
  actorRole: "patient" | "therapist";
  bookingStatus: string;
  endsAt: string;
  financialStatus: string | null;
  hardEndsAt?: string | null;
  now?: Date;
  patientHasJoined?: boolean;
  patientHasTimelyArrival?: boolean;
  startsAt: string;
  therapistStatus?: string;
  therapistPresent?: boolean;
  videoSessionReady: boolean;
  videoSessionStatus: string | null;
}): VideoAccessState {
  const now = input.now ?? new Date();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const availableFrom = new Date(
    startsAt.getTime() -
      VIDEO_SESSION_ACCESS_WINDOW.beforeStartsMinutes * 60_000,
  );
  const firstPatientJoinUntil = new Date(
    startsAt.getTime() +
      VIDEO_SESSION_ACCESS_WINDOW.firstPatientJoinAfterStartsMinutes * 60_000,
  );
  const patientEntryEntitled = Boolean(
    input.patientHasJoined || input.patientHasTimelyArrival,
  );
  const availableUntil = input.actorRole === "patient" && !patientEntryEntitled
    ? firstPatientJoinUntil
    : endsAt;
  const hardEndsAt = input.hardEndsAt ? new Date(input.hardEndsAt) : null;
  let reason: VideoAccessReason | null = null;

  if (
    input.actorRole === "therapist" &&
    (input.therapistStatus === "suspended" ||
      input.therapistStatus === "rejected")
  ) {
    reason = input.therapistStatus === "suspended"
      ? "THERAPIST_SUSPENDED"
      : "THERAPIST_NOT_ALLOWED";
  } else if (
    [
      "cancelled_by_patient",
      "cancelled_by_therapist",
      "no_show_patient",
      "no_show_therapist",
      "refunded",
    ].includes(input.bookingStatus)
  ) {
    reason = "BOOKING_CANCELLED";
  } else if (input.financialStatus !== "paid") {
    reason = "PAYMENT_NOT_CONFIRMED";
  } else if (now < availableFrom) {
    reason = "TOO_EARLY";
  } else if (now >= endsAt) {
    reason = "TOO_LATE";
  } else if (
    input.actorRole === "patient" &&
    !patientEntryEntitled &&
    now > firstPatientJoinUntil
  ) {
    reason = "TOO_LATE";
  } else if (hardEndsAt && now >= hardEndsAt) {
    reason = "HARD_TIMEOUT";
  } else if (
    input.videoSessionStatus === "ended" ||
    input.videoSessionStatus === "canceled"
  ) {
    reason = "TOO_LATE";
  } else if (input.videoSessionStatus === "failed") {
    reason = "UNKNOWN";
  } else if (!input.videoSessionReady) {
    reason = "VIDEO_SESSION_NOT_READY";
  } else if (input.actorRole === "patient" && !input.therapistPresent) {
    reason = "THERAPIST_NOT_IN_SESSION";
  }

  return {
    allowed: reason === null,
    availableFrom: availableFrom.toISOString(),
    availableUntil: availableUntil.toISOString(),
    hardEndsAt: input.hardEndsAt ?? null,
    scheduledEndsAt: endsAt.toISOString(),
    scheduledStartsAt: startsAt.toISOString(),
    videoSessionStatus: input.videoSessionStatus ?? "not_available",
    reason,
    serverNow: now.toISOString(),
  };
}

export function getVideoAccessMessage(reason: VideoAccessReason) {
  const messages: Record<VideoAccessReason, string> = {
    BOOKING_CANCELLED: "Esta sessao nao esta mais ativa.",
    VIDEO_SESSION_NOT_READY: "A sala ainda esta em preparacao.",
    PAYMENT_NOT_CONFIRMED: "Aguardamos a confirmacao do pagamento.",
    THERAPIST_NOT_ALLOWED: "O acesso a esta sessao nao esta autorizado.",
    THERAPIST_NOT_IN_SESSION: "Aguardando o terapeuta iniciar a sessao.",
    THERAPIST_SUSPENDED: "O acesso a sala esta bloqueado para este perfil.",
    HARD_TIMEOUT: "O limite seguro desta sessao foi atingido.",
    TOO_EARLY: "A entrada fica disponivel perto do horario.",
    TOO_LATE: "A janela de acesso desta sessao foi encerrada.",
    UNKNOWN: "Nao foi possivel liberar o acesso agora.",
  };

  return messages[reason];
}
