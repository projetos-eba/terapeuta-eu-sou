import {
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  RescheduleStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
} from "@/domain/tes";
import {
  BOOKING_JOIN_WINDOW_BEFORE_MINUTES,
  BOOKING_JOIN_WINDOW_BEFORE_MS,
} from "./booking-status";

import type {
  SessionPresentation,
  SessionReadModelItem,
} from "./session-read-model.types";

const closedBookingStatuses: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.CancelledByPatient,
  BookingStatus.CancelledByTherapist,
  BookingStatus.NoShowPatient,
  BookingStatus.NoShowTherapist,
  BookingStatus.CancelledByPayment,
  BookingStatus.Refunded,
]);

const mutableBookingStatuses: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.Confirmed,
  BookingStatus.PendingPayment,
]);

const closedFinancialStatuses: ReadonlySet<SessionFinancialStatus> = new Set([
  SessionFinancialStatus.Canceled,
  SessionFinancialStatus.PartiallyRefunded,
  SessionFinancialStatus.Refunded,
]);

const closedFulfillmentStatuses: ReadonlySet<FulfillmentStatus> = new Set([
  FulfillmentStatus.Cancelled,
  FulfillmentStatus.NotPerformed,
]);

const completableFulfillmentStatuses: ReadonlySet<FulfillmentStatus | null> =
  new Set([
    null,
    FulfillmentStatus.Scheduled,
    FulfillmentStatus.OccurredPendingConfirmation,
  ]);

const completedFulfillmentStatuses: ReadonlySet<FulfillmentStatus> = new Set([
  FulfillmentStatus.AutoConfirmed,
  FulfillmentStatus.ConfirmedByPatientReview,
  FulfillmentStatus.ConfirmedByTherapist,
]);

export function mapSessionPresentation(
  session: SessionReadModelItem,
  now = new Date(),
): SessionPresentation {
  const endsAt = new Date(session.endsAt).getTime();
  const startsAt = new Date(session.startsAt).getTime();
  const currentTime = now.getTime();
  const bookingIsClosed = closedBookingStatuses.has(session.bookingStatus);
  const isFuture = startsAt > currentTime;
  const hasPendingReschedule =
    session.rescheduleStatus === RescheduleStatus.Pending;
  const paymentIsConfirmed =
    session.financialStatus === SessionFinancialStatus.Paid;
  const canAccessZoom = session.zoomAccess.allowed;
  const sessionIsClosed =
    bookingIsClosed ||
    (session.financialStatus !== null &&
      closedFinancialStatuses.has(session.financialStatus)) ||
    (session.fulfillmentStatus !== null &&
      closedFulfillmentStatuses.has(session.fulfillmentStatus));
  const canReschedule =
    !sessionIsClosed &&
    isFuture &&
    !hasPendingReschedule &&
    mutableBookingStatuses.has(session.bookingStatus);
  const canCancel =
    !sessionIsClosed &&
    isFuture &&
    mutableBookingStatuses.has(session.bookingStatus);
  const canRegisterAttendance =
    !bookingIsClosed &&
    currentTime >= endsAt &&
    session.attendanceStatus === AttendanceStatus.Pending;
  const canComplete =
    canRegisterAttendance &&
    paymentIsConfirmed &&
    completableFulfillmentStatuses.has(session.fulfillmentStatus);

  const actions = {
    canAccessZoom,
    canCancel,
    canComplete,
    canRegisterAttendance,
    canReschedule,
    primary: getPrimaryAction({
      canAccessZoom,
      canComplete,
      hasPendingReschedule,
    }),
    secondary: getSecondaryActions({
      canCancel,
      canComplete,
      canRegisterAttendance,
      canReschedule,
      hasFinancialSummary: session.financialStatus !== null,
    }),
  };

  if (session.financialStatus === SessionFinancialStatus.Refunded) {
    return presentation(
      "refunded",
      "Reembolsada",
      "O pagamento desta sessão foi reembolsado.",
      "medium",
      "neutral",
      actions,
    );
  }

  if (session.financialStatus === SessionFinancialStatus.PartiallyRefunded) {
    return presentation(
      "refunded",
      "Reembolso parcial",
      "Há um reembolso parcial registrado para esta sessão.",
      "medium",
      "neutral",
      actions,
    );
  }

  if (session.financialStatus === SessionFinancialStatus.Canceled) {
    return presentation(
      "cancelled",
      "Cancelada",
      "O pagamento desta sessão foi cancelado e ela não pode mais acontecer.",
      "medium",
      "neutral",
      actions,
    );
  }

  if (
    session.fulfillmentStatus === FulfillmentStatus.Cancelled ||
    session.fulfillmentStatus === FulfillmentStatus.NotPerformed
  ) {
    return presentation(
      "cancelled",
      "Não realizada",
      "Esta sessão já foi encerrada e não pode ser cancelada novamente.",
      "medium",
      "neutral",
      actions,
    );
  }

  if (bookingIsClosed) {
    return presentation(
      "cancelled",
      "Cancelada",
      getCancellationDescription(session),
      "medium",
      "neutral",
      actions,
    );
  }

  if (hasPendingReschedule) {
    return presentation(
      "reschedule_requested",
      "Reagendamento solicitado",
      "Existe uma proposta de novo horário aguardando análise.",
      "high",
      "warning",
      actions,
    );
  }

  if (
    session.financialStatus === null ||
    session.financialStatus === SessionFinancialStatus.Pending ||
    session.financialStatus === SessionFinancialStatus.Processing ||
    session.bookingStatus === BookingStatus.PendingPayment
  ) {
    return presentation(
      "payment_pending",
      "Pagamento pendente",
      "A reserva aguarda a confirmação do pagamento.",
      "high",
      "warning",
      actions,
    );
  }

  if (
    session.financialStatus === SessionFinancialStatus.Failed ||
    session.financialStatus === SessionFinancialStatus.Disputed ||
    session.cancellationRequiresReview
  ) {
    return presentation(
      "requires_attention",
      "Requer atenção",
      "Há uma ocorrência operacional ou financeira para revisar.",
      "critical",
      "danger",
      actions,
    );
  }

  if (
    session.bookingStatus === BookingStatus.Completed ||
    (session.fulfillmentStatus !== null &&
      completedFulfillmentStatuses.has(session.fulfillmentStatus))
  ) {
    return presentation(
      "completed",
      "Realizada",
      "A realização da sessão foi registrada.",
      "low",
      "success",
      actions,
    );
  }

  if (session.videoSessionStatus === "active") {
    return presentation(
      "in_progress",
      "Em andamento",
      "A sala online está em andamento.",
      "high",
      "info",
      actions,
    );
  }

  if (canAccessZoom) {
    return presentation(
      "ready",
      "Pronta para iniciar",
      "Sua entrada na sala online está liberada.",
      "high",
      "success",
      actions,
    );
  }

  if (
    session.zoomAccess.reason === ZoomAccessReason.VideoSessionNotReady &&
    currentTime >= startsAt - BOOKING_JOIN_WINDOW_BEFORE_MS
  ) {
    return presentation(
      "room_preparing",
      "Sala em preparação",
      "O encontro esta confirmado, mas a sala ainda esta sendo preparada.",
      "high",
      "warning",
      actions,
    );
  }

  if (session.bookingStatus === BookingStatus.Confirmed) {
    return presentation(
      "confirmed",
      "Confirmada",
      getConfirmedDescription(session),
      "low",
      "info",
      actions,
    );
  }

  return presentation(
    "requires_attention",
    "Requer atenção",
    "O estado desta sessão precisa de revisão operacional.",
    "high",
    "warning",
    actions,
  );
}

export function getZoomAccessLabel(access: SessionReadModelItem["zoomAccess"]) {
  if (access.allowed) return "Entrar na sessão";

  const labels = {
    [ZoomAccessReason.BookingCancelled]: "Sessão cancelada",
    [ZoomAccessReason.VideoSessionNotReady]: "Sala em preparacao",
    [ZoomAccessReason.PaymentNotConfirmed]: "Aguardando pagamento",
    [ZoomAccessReason.TherapistNotAllowed]: "Acesso não autorizado",
    [ZoomAccessReason.TherapistNotInSession]: "Aguardando terapeuta",
    [ZoomAccessReason.TherapistSuspended]: "Acesso suspenso",
    [ZoomAccessReason.HardTimeout]: "Tempo encerrado",
    [ZoomAccessReason.TooEarly]: `Disponível ${BOOKING_JOIN_WINDOW_BEFORE_MINUTES} min antes`,
    [ZoomAccessReason.TooLate]: "Janela de acesso encerrada",
    [ZoomAccessReason.SessionEnded]: "Sessão encerrada",
    [ZoomAccessReason.ArrivalWindowExpired]: "Prazo de chegada encerrado",
    [ZoomAccessReason.TechnicalUnavailable]: "Vídeo indisponível no momento",
    [ZoomAccessReason.Unknown]: "Acesso indisponível",
  };

  return access.reason ? labels[access.reason] : "Acesso indisponível";
}

export function getSessionOperationDisabledReason(
  session: Pick<
    SessionReadModelItem,
    "bookingStatus" | "financialStatus" | "fulfillmentStatus" | "startsAt"
  >,
  action: "cancel" | "reschedule",
) {
  const actionLabel = action === "cancel" ? "cancelamento" : "reagendamento";

  if (session.financialStatus === SessionFinancialStatus.Canceled) {
    return "O pagamento foi cancelado; não é possível realizar o cancelamento ou reagendamento desta sessão.";
  }

  if (
    session.financialStatus === SessionFinancialStatus.PartiallyRefunded ||
    session.financialStatus === SessionFinancialStatus.Refunded
  ) {
    return "O pagamento já foi reembolsado; não é possível realizar o cancelamento ou reagendamento desta sessão.";
  }

  if (
    closedBookingStatuses.has(session.bookingStatus) ||
    (session.fulfillmentStatus !== null &&
      closedFulfillmentStatuses.has(session.fulfillmentStatus))
  ) {
    return `Esta sessão já foi encerrada; não é possível realizar o ${actionLabel} novamente.`;
  }

  if (new Date(session.startsAt).getTime() <= Date.now()) {
    return `O horário já passou; não é possível realizar o ${actionLabel} agora.`;
  }

  return `Esta sessão não está disponível para ${actionLabel}.`;
}

function getPrimaryAction(input: {
  canAccessZoom: boolean;
  canComplete: boolean;
  hasPendingReschedule: boolean;
}): SessionPresentation["actions"]["primary"] {
  if (input.canAccessZoom) {
    return { action: "join_zoom", label: "Entrar na sessão" };
  }

  if (input.hasPendingReschedule) {
    return { action: "review_reschedule", label: "Revisar reagendamento" };
  }

  if (input.canComplete) {
    return { action: "complete", label: "Concluir sessão" };
  }

  return { action: "view_detail", label: "Ver detalhes" };
}

function getSecondaryActions(input: {
  canCancel: boolean;
  canComplete: boolean;
  canRegisterAttendance: boolean;
  canReschedule: boolean;
  hasFinancialSummary: boolean;
}): SessionPresentation["actions"]["secondary"] {
  const actions: SessionPresentation["actions"]["secondary"] = [];

  if (input.canReschedule) {
    actions.push({ action: "request_reschedule", label: "Reagendar" });
  }
  if (input.canCancel) {
    actions.push({ action: "cancel", label: "Cancelar" });
  }
  if (input.canRegisterAttendance && !input.canComplete) {
    actions.push({
      action: "register_attendance",
      label: "Registrar presença",
    });
  }
  if (input.hasFinancialSummary) {
    actions.push({ action: "view_financial", label: "Ver financeiro" });
  }

  return actions;
}

function presentation(
  state: SessionPresentation["state"],
  label: string,
  description: string,
  priority: SessionPresentation["priority"],
  tone: SessionPresentation["tone"],
  actions: SessionPresentation["actions"],
): SessionPresentation {
  return { actions, description, label, priority, state, tone };
}

function getCancellationDescription(session: SessionReadModelItem) {
  if (session.cancellationRequiresReview) {
    return "O cancelamento aguarda revisão operacional.";
  }

  return session.cancellationDecision
    ? "O cancelamento foi processado conforme a política registrada."
    : "Esta reserva não está mais ativa.";
}

function getConfirmedDescription(session: SessionReadModelItem) {
  if (session.zoomAccess.reason === ZoomAccessReason.TooEarly) {
    return "A sessão está confirmada e a sala será liberada perto do horário.";
  }

  return "A sessão está confirmada e pronta para acompanhamento.";
}
