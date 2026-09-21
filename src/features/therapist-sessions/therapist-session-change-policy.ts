import { SessionFinancialStatus } from "@/domain/tes";

const HOUR_MS = 60 * 60 * 1000;

const paymentStartedReason =
  "A cobrança desta sessão já foi iniciada. Para manter tudo seguro, fale com o suporte.";
const withinTwentyFourHoursReason =
  "Esta sessão está a menos de 24 horas. Cancelamentos e reagendamentos não estão disponíveis.";
const rescheduleNoticeReason =
  "Para que a pessoa tenha tempo de responder, o reagendamento pelo terapeuta só pode ser solicitado com mais de 48 horas de antecedência.";
const unavailableDeadlineReason =
  "Não foi possível confirmar o prazo desta sessão. Tente novamente em instantes.";

export type TherapistSessionChangePolicy = {
  canCancel: boolean;
  canReschedule: boolean;
  cancelDisabledReason: string | null;
  rescheduleDisabledReason: string | null;
};

export function getTherapistSessionChangePolicy(input: {
  canCancelByLifecycle: boolean;
  canRescheduleByLifecycle: boolean;
  financialStatus: SessionFinancialStatus | null;
  now?: Date;
  startsAt: string;
}): TherapistSessionChangePolicy {
  const base = {
    canCancel: input.canCancelByLifecycle,
    canReschedule: input.canRescheduleByLifecycle,
    cancelDisabledReason: null,
    rescheduleDisabledReason: null,
  };

  if (!input.canCancelByLifecycle && !input.canRescheduleByLifecycle) {
    return base;
  }

  if (input.financialStatus !== SessionFinancialStatus.Pending) {
    return {
      canCancel: false,
      canReschedule: false,
      cancelDisabledReason: paymentStartedReason,
      rescheduleDisabledReason: paymentStartedReason,
    };
  }

  const startsAt = new Date(input.startsAt).getTime();
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(now)) {
    return {
      canCancel: false,
      canReschedule: false,
      cancelDisabledReason: unavailableDeadlineReason,
      rescheduleDisabledReason: unavailableDeadlineReason,
    };
  }

  const remainingMs = startsAt - now;
  if (remainingMs <= 24 * HOUR_MS) {
    return {
      canCancel: false,
      canReschedule: false,
      cancelDisabledReason: withinTwentyFourHoursReason,
      rescheduleDisabledReason: withinTwentyFourHoursReason,
    };
  }

  if (remainingMs <= 48 * HOUR_MS) {
    return {
      canCancel: input.canCancelByLifecycle,
      canReschedule: false,
      cancelDisabledReason: null,
      rescheduleDisabledReason: rescheduleNoticeReason,
    };
  }

  return base;
}
