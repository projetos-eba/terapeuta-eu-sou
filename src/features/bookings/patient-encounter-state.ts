import {
  BookingStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
  type ZoomAccessState,
  type ZoomVideoSessionStatus as ZoomVideoSessionStatusValue,
} from "@/domain/tes";

export type PatientEncounterPaymentKind =
  | "awaiting_webhook"
  | "cancelled"
  | "confirmed"
  | "disputed"
  | "expired"
  | "failed"
  | "not_started"
  | "processing"
  | "refunded";

export type PatientEncounterWaitingRoomKind =
  | "entry_available"
  | "ended"
  | "operational_unavailable"
  | "payment_required"
  | "therapist_present"
  | "therapist_absent_prolonged"
  | "too_early"
  | "waiting_therapist";

export type PatientEncounterAction =
  | "contact_support"
  | "enter_without_camera"
  | "join_zoom"
  | "refresh_waiting_room"
  | "renew_zoom_access"
  | "retry_payment"
  | "review_permissions"
  | "test_devices"
  | "verify_connection";

export type PatientEncounterPresentationState = {
  actions: PatientEncounterAction[];
  payment: {
    kind: PatientEncounterPaymentKind;
    message: string;
    retryAllowed: boolean;
    slotState: "confirmed" | "released" | "reserved" | "review";
    title: string;
  };
  preparation: {
    checklist: string[];
    countdownLabel: string | null;
    deviceCheckRecommended: boolean;
    title: string;
  };
  waitingRoom: {
    kind: PatientEncounterWaitingRoomKind;
    message: string;
    title: string;
  };
};

type Input = {
  bookingStatus: BookingStatus | "live" | string;
  endsAt: string;
  financialStatus: SessionFinancialStatus | null;
  now?: Date;
  patientHasJoined?: boolean;
  provider: "external" | "google_meet" | "zoom";
  startsAt: string;
  zoomAccess?: ZoomAccessState | null;
};

const JOIN_WINDOW_BEFORE_MS = 15 * 60_000;
const FIRST_JOIN_WINDOW_AFTER_MS = 15 * 60_000;
const THERAPIST_ABSENCE_THRESHOLD_MS = 10 * 60_000;

export function getPatientEncounterPresentationState({
  bookingStatus,
  endsAt,
  financialStatus,
  now = new Date(),
  patientHasJoined = false,
  provider,
  startsAt,
  zoomAccess = null,
}: Input): PatientEncounterPresentationState {
  const nowMs = now.getTime();
  const startsAtMs = Date.parse(startsAt);
  const endsAtMs = Date.parse(endsAt);
  const payment = getPaymentState({
    bookingStatus,
    financialStatus,
    nowMs,
    startsAtMs,
  });
  const waitingRoom = getWaitingRoomState({
    bookingStatus,
    endsAtMs,
    financialStatus,
    nowMs,
    patientHasJoined,
    provider,
    startsAtMs,
    zoomAccess,
  });
  const actions = getActions(payment.kind, waitingRoom.kind);

  return {
    actions,
    payment,
    preparation: {
      checklist: [
        "Escolha um lugar tranquilo e reservado",
        "Use fones de ouvido quando possível",
        "Teste câmera e microfone antes da sala abrir",
        "Mantenha uma conexão estável e privacidade no ambiente",
      ],
      countdownLabel: getCountdownLabel(
        startsAtMs - JOIN_WINDOW_BEFORE_MS,
        nowMs,
      ),
      deviceCheckRecommended:
        payment.kind === "confirmed" &&
        waitingRoom.kind !== "ended" &&
        waitingRoom.kind !== "operational_unavailable",
      title:
        payment.kind === "confirmed"
          ? "Prepare seu encontro"
          : "Confirme o pagamento para preparar a sala",
    },
    waitingRoom,
  };
}

function getPaymentState({
  bookingStatus,
  financialStatus,
  nowMs,
  startsAtMs,
}: {
  bookingStatus: string;
  financialStatus: SessionFinancialStatus | null;
  nowMs: number;
  startsAtMs: number;
}): PatientEncounterPresentationState["payment"] {
  if (financialStatus === SessionFinancialStatus.Paid) {
    return {
      kind: "confirmed",
      message:
        "Seu pagamento foi confirmado. A sala será liberada dentro da janela segura do encontro.",
      retryAllowed: false,
      slotState: "confirmed",
      title: "Pagamento confirmado",
    };
  }

  if (financialStatus === SessionFinancialStatus.Processing) {
    return {
      kind: "processing",
      message:
        "Recebemos sua tentativa de pagamento e aguardamos a confirmação final. Atualizar a página não confirma o encontro.",
      retryAllowed: false,
      slotState: "reserved",
      title: "Pagamento em processamento",
    };
  }

  if (financialStatus === SessionFinancialStatus.Pending) {
    const expired = Number.isFinite(startsAtMs) && nowMs > startsAtMs;

    return {
      kind: expired ? "expired" : "awaiting_webhook",
      message: expired
        ? "A confirmação não chegou a tempo e este horário não deve mais ser tratado como reservado."
        : "Estamos confirmando o pagamento. O horário permanece em análise por enquanto.",
      retryAllowed: !expired,
      slotState: expired ? "released" : "review",
      title: expired ? "Pagamento expirado" : "Aguardando confirmação",
    };
  }

  if (financialStatus === SessionFinancialStatus.Failed) {
    const canRetry = Number.isFinite(startsAtMs) && nowMs < startsAtMs;

    return {
      kind: "failed",
      message:
        "Não foi possível confirmar o pagamento. A entrada na sala online só será liberada após a confirmação.",
      retryAllowed: canRetry,
      slotState: canRetry ? "review" : "released",
      title: "Pagamento não confirmado",
    };
  }

  if (financialStatus === SessionFinancialStatus.Canceled) {
    return {
      kind: "cancelled",
      message: "A cobrança foi cancelada e a sala não está disponível.",
      retryAllowed: false,
      slotState: "released",
      title: "Cobrança cancelada",
    };
  }

  if (
    financialStatus === SessionFinancialStatus.Refunded ||
    financialStatus === SessionFinancialStatus.PartiallyRefunded
  ) {
    return {
      kind: "refunded",
      message:
        "Este encontro possui reembolso registrado. Use o histórico para acompanhar os próximos movimentos.",
      retryAllowed: false,
      slotState: "released",
      title: "Reembolso registrado",
    };
  }

  if (financialStatus === SessionFinancialStatus.Disputed) {
    return {
      kind: "disputed",
      message:
        "Este pagamento está em análise. O acesso ao encontro fica bloqueado até a situação ser resolvida.",
      retryAllowed: false,
      slotState: "review",
      title: "Pagamento em análise",
    };
  }

  if (bookingStatus === BookingStatus.PendingPayment) {
    return {
      kind: "not_started",
      message:
        "Ainda não há confirmação do pagamento para este encontro. A sala só será liberada após a confirmação.",
      retryAllowed: true,
      slotState: "review",
      title: "Pagamento pendente",
    };
  }

  return {
    kind: "not_started",
    message:
      "Não encontramos um pagamento confirmado para este encontro. A entrada permanece bloqueada.",
    retryAllowed: false,
    slotState: "review",
    title: "Pagamento não localizado",
  };
}

function getWaitingRoomState({
  bookingStatus,
  endsAtMs,
  financialStatus,
  nowMs,
  patientHasJoined,
  provider,
  startsAtMs,
  zoomAccess,
}: {
  bookingStatus: string;
  endsAtMs: number;
  financialStatus: SessionFinancialStatus | null;
  nowMs: number;
  patientHasJoined: boolean;
  provider: "external" | "google_meet" | "zoom";
  startsAtMs: number;
  zoomAccess: ZoomAccessState | null;
}): PatientEncounterPresentationState["waitingRoom"] {
  if (isTerminalBookingStatus(bookingStatus)) {
    return {
      kind: "ended",
      message: "Este encontro já foi encerrado ou cancelado.",
      title: "Sala encerrada",
    };
  }

  if (provider !== "zoom") {
    return {
      kind: "operational_unavailable",
      message:
        "Este encontro não usa a sala Zoom autenticada. Siga as orientações exibidas para a videochamada.",
      title: "Sala externa",
    };
  }

  if (financialStatus !== SessionFinancialStatus.Paid) {
    return {
      kind: "payment_required",
      message: "A sala só abre após confirmação financeira persistida.",
      title: "Pagamento necessário",
    };
  }

  if (zoomAccess?.allowed) {
    const status = zoomAccess.videoSessionStatus;

    return {
      kind:
        status === ZoomVideoSessionStatus.Active
          ? "therapist_present"
          : "entry_available",
      message:
        status === ZoomVideoSessionStatus.Active
          ? "O terapeuta já está presente. Você pode entrar no encontro."
          : "A sala de espera está disponível. Entre para aguardar o terapeuta.",
      title:
        status === ZoomVideoSessionStatus.Active
          ? "Terapeuta presente"
          : "Entrada disponível",
    };
  }

  if (zoomAccess?.reason === ZoomAccessReason.TooEarly) {
    return {
      kind: "too_early",
      message:
        "A sala de espera ficará disponível 15 minutos antes do horário agendado.",
      title: "A sala ainda não abriu",
    };
  }

  if (zoomAccess?.reason === ZoomAccessReason.TherapistNotInSession) {
    return {
      kind:
        Number.isFinite(startsAtMs) &&
        nowMs - startsAtMs >= THERAPIST_ABSENCE_THRESHOLD_MS
          ? "therapist_absent_prolonged"
          : "waiting_therapist",
      message:
        "A entrada do paciente é liberada quando a presença do terapeuta é confirmada pelo Zoom.",
      title: "Aguardando terapeuta",
    };
  }

  if (
    zoomAccess?.reason === ZoomAccessReason.TooLate ||
    zoomAccess?.reason === ZoomAccessReason.HardTimeout ||
    (Number.isFinite(endsAtMs) && nowMs >= endsAtMs)
  ) {
    return {
      kind: "ended",
      message:
        "A janela de entrada foi encerrada. Se precisar de ajuda, fale com o suporte.",
      title: "Janela encerrada",
    };
  }

  if (
    Number.isFinite(startsAtMs) &&
    nowMs < startsAtMs - JOIN_WINDOW_BEFORE_MS
  ) {
    return {
      kind: "too_early",
      message:
        "A sala de espera ficará disponível 15 minutos antes do horário agendado.",
      title: "A sala ainda não abriu",
    };
  }

  if (
    Number.isFinite(startsAtMs) &&
    Number.isFinite(endsAtMs) &&
    nowMs < endsAtMs &&
    (patientHasJoined || nowMs <= startsAtMs + FIRST_JOIN_WINDOW_AFTER_MS)
  ) {
    return {
      kind: "entry_available",
      message:
        "A sala de espera está disponível. Entre para aguardar o terapeuta.",
      title: "Entrada disponível",
    };
  }

  if (
    Number.isFinite(startsAtMs) &&
    nowMs > startsAtMs + FIRST_JOIN_WINDOW_AFTER_MS
  ) {
    return {
      kind: "ended",
      message:
        "A janela de entrada foi encerrada. Se precisar de ajuda, fale com o suporte.",
      title: "Janela encerrada",
    };
  }

  return {
    kind: "operational_unavailable",
    message:
      "A sala não está disponível agora. Tente atualizar ou acione o suporte com a referência do encontro.",
    title: "Sala indisponível",
  };
}

function getActions(
  paymentKind: PatientEncounterPaymentKind,
  waitingRoomKind: PatientEncounterWaitingRoomKind,
): PatientEncounterAction[] {
  const actions = new Set<PatientEncounterAction>();

  if (paymentKind === "failed" || paymentKind === "not_started") {
    actions.add("retry_payment");
  }

  if (paymentKind !== "confirmed") {
    actions.add("contact_support");
    return [...actions];
  }

  actions.add("test_devices");

  if (
    waitingRoomKind === "entry_available" ||
    waitingRoomKind === "therapist_present"
  ) {
    actions.add("join_zoom");
    actions.add("enter_without_camera");
  }

  if (
    waitingRoomKind === "waiting_therapist" ||
    waitingRoomKind === "therapist_absent_prolonged" ||
    waitingRoomKind === "operational_unavailable"
  ) {
    actions.add("refresh_waiting_room");
    actions.add("renew_zoom_access");
    actions.add("verify_connection");
  }

  if (waitingRoomKind === "therapist_absent_prolonged") {
    actions.add("contact_support");
  }

  actions.add("review_permissions");

  return [...actions];
}

function getCountdownLabel(availableFromMs: number, nowMs: number) {
  if (!Number.isFinite(availableFromMs)) return null;

  const remainingMs = availableFromMs - nowMs;
  if (remainingMs <= 0) return "A janela de entrada já pode estar aberta.";

  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes < 60) return `A sala abre em cerca de ${minutes} min.`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0
    ? `A sala abre em cerca de ${hours}h${String(rest).padStart(2, "0")}.`
    : `A sala abre em cerca de ${hours}h.`;
}

function isTerminalBookingStatus(status: string) {
  return (
    status === BookingStatus.Completed ||
    status === BookingStatus.CancelledByPatient ||
    status === BookingStatus.CancelledByTherapist ||
    status === BookingStatus.NoShowPatient ||
    status === BookingStatus.NoShowTherapist ||
    status === BookingStatus.CancelledByPayment ||
    status === BookingStatus.Refunded
  );
}

export function getZoomWaitingRoomStatusFromAccess(
  access: ZoomAccessState | null,
  now = new Date(),
): PatientEncounterWaitingRoomKind {
  if (!access) return "operational_unavailable";

  if (access.allowed) {
    return access.videoSessionStatus === ZoomVideoSessionStatus.Active
      ? "therapist_present"
      : "entry_available";
  }

  if (access.reason === ZoomAccessReason.TooEarly) return "too_early";
  if (access.reason === ZoomAccessReason.TherapistNotInSession) {
    const availableFromMs = access.availableFrom
      ? Date.parse(access.availableFrom)
      : NaN;
    const serverNowMs = access.serverNow ? Date.parse(access.serverNow) : NaN;
    const referenceNowMs = Number.isFinite(serverNowMs)
      ? serverNowMs
      : now.getTime();

    return Number.isFinite(availableFromMs) &&
      referenceNowMs - availableFromMs >= THERAPIST_ABSENCE_THRESHOLD_MS
      ? "therapist_absent_prolonged"
      : "waiting_therapist";
  }
  if (
    access.reason === ZoomAccessReason.TooLate ||
    access.reason === ZoomAccessReason.HardTimeout ||
    access.videoSessionStatus === ZoomVideoSessionStatus.Ended
  ) {
    return "ended";
  }

  return "operational_unavailable";
}

export function getZoomRecoveryActionLabels(
  kind: PatientEncounterWaitingRoomKind,
) {
  const base = ["Tentar novamente", "Revisar permissões", "Verificar conexão"];

  if (kind === "therapist_absent_prolonged") {
    return [...base, "Copiar referência", "Falar com suporte"];
  }

  if (kind === "ended") return ["Voltar à sala de espera", "Copiar referência"];

  return [...base, "Renovar acesso"];
}

export function isKnownZoomVideoSessionStatus(
  value: string | null | undefined,
): value is ZoomVideoSessionStatusValue {
  return Object.values(ZoomVideoSessionStatus).includes(
    value as ZoomVideoSessionStatusValue,
  );
}
