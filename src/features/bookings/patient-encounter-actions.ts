import {
  BookingStatus,
  SessionFinancialStatus,
  type SessionFinancialStatus as SessionFinancialStatusValue,
} from "@/domain/tes";

export type PatientEncounterActionPolicyInput = {
  bookingStatus: string;
  cancellationPolicy: {
    freeUntilHours: number;
    lateCancelFeePercent: number;
    noShowFeePercent: number;
  };
  cancellationDecision?: {
    decision: string;
    refundAmountCents: number;
    requiresManualReview: boolean;
    reviewDueAt: string | null;
  } | null;
  endsAt: string;
  financialStatus: SessionFinancialStatusValue | string | null;
  now?: Date;
  startsAt: string;
};

export type PatientEncounterActionPolicy = {
  cancellation: {
    allowed: boolean;
    disabledReason: string | null;
    impactLabel: string;
    refundState:
      | "not_applicable"
      | "not_started"
      | "pending"
      | "manual_review"
      | "partial"
      | "full"
      | "none";
    title: string;
  };
  rating: {
    allowed: boolean;
    disabledReason: string | null;
  };
  reschedule: {
    allowed: boolean;
    disabledReason: string | null;
  };
};

const ONE_HOUR_MS = 60 * 60 * 1000;

export function getPatientEncounterActionPolicy({
  bookingStatus,
  cancellationDecision = null,
  cancellationPolicy,
  endsAt,
  financialStatus,
  now = new Date(),
  startsAt,
}: PatientEncounterActionPolicyInput): PatientEncounterActionPolicy {
  const nowMs = now.getTime();
  const startsAtMs = Date.parse(startsAt);
  const endsAtMs = Date.parse(endsAt);
  const terminal = isTerminalBookingStatus(bookingStatus);
  const completed = bookingStatus === BookingStatus.Completed;
  const paid = financialStatus === SessionFinancialStatus.Paid;
  const future = Number.isFinite(startsAtMs) && startsAtMs > nowMs;
  const rescheduleDisabledReason = getRescheduleDisabledReason({
    bookingStatus,
    financialStatus,
    future,
    terminal,
  });
  const cancelDisabledReason = getCancelDisabledReason({
    bookingStatus,
    financialStatus,
    future,
    terminal,
  });

  return {
    cancellation: {
      allowed: cancelDisabledReason === null,
      disabledReason: cancelDisabledReason,
      impactLabel: getCancellationImpactLabel({
        cancellationDecision,
        cancellationPolicy,
        endsAtMs,
        financialStatus,
        nowMs,
        startsAtMs,
      }),
      refundState: getRefundState(cancellationDecision, financialStatus),
      title: getCancellationTitle(cancellationDecision, financialStatus),
    },
    rating: {
      allowed:
        completed && paid && Number.isFinite(endsAtMs) && nowMs >= endsAtMs,
      disabledReason:
        completed && !paid
          ? "A avaliação é liberada apenas para encontro concluído com pagamento confirmado."
          : completed && paid && Number.isFinite(endsAtMs) && nowMs < endsAtMs
            ? "A avaliação será liberada após o horário final do encontro."
            : completed
              ? null
              : "A avaliação fica disponível depois da conclusão do encontro.",
    },
    reschedule: {
      allowed: rescheduleDisabledReason === null,
      disabledReason: rescheduleDisabledReason,
    },
  };
}

function getRescheduleDisabledReason({
  bookingStatus,
  financialStatus,
  future,
  terminal,
}: {
  bookingStatus: string;
  financialStatus: string | null;
  future: boolean;
  terminal: boolean;
}) {
  if (terminal) return "Este encontro já foi encerrado ou cancelado.";
  if (bookingStatus === BookingStatus.PendingPayment) {
    return "Confirme o pagamento antes de solicitar reagendamento.";
  }
  if (financialStatus !== SessionFinancialStatus.Paid) {
    return "Reagendamento exige pagamento confirmado.";
  }
  if (!future) return "O horário do encontro já começou ou passou.";

  return null;
}

function getCancelDisabledReason({
  bookingStatus,
  financialStatus,
  future,
  terminal,
}: {
  bookingStatus: string;
  financialStatus: string | null;
  future: boolean;
  terminal: boolean;
}) {
  if (terminal) return "Este encontro já foi encerrado ou cancelado.";
  if (bookingStatus === BookingStatus.PendingPayment) {
    return "Não há cobrança confirmada para cancelar por este fluxo.";
  }
  if (financialStatus !== SessionFinancialStatus.Paid) {
    return "Cancelamento financeiro exige pagamento confirmado.";
  }
  if (!future)
    return "O cancelamento automático não fica disponível após o início.";

  return null;
}

function getCancellationImpactLabel({
  cancellationDecision,
  cancellationPolicy,
  endsAtMs,
  financialStatus,
  nowMs,
  startsAtMs,
}: {
  cancellationDecision: PatientEncounterActionPolicyInput["cancellationDecision"];
  cancellationPolicy: PatientEncounterActionPolicyInput["cancellationPolicy"];
  endsAtMs: number;
  financialStatus: string | null;
  nowMs: number;
  startsAtMs: number;
}) {
  if (cancellationDecision) {
    if (cancellationDecision.requiresManualReview) {
      return "Cancelamento registrado. Reembolso em análise manual.";
    }
    if (cancellationDecision.refundAmountCents > 0) {
      return `Cancelamento registrado. Reembolso previsto: ${formatCurrency(cancellationDecision.refundAmountCents)}.`;
    }

    return "Cancelamento registrado sem reembolso automático.";
  }

  if (financialStatus !== SessionFinancialStatus.Paid) {
    return "Sem pagamento confirmado, não há reembolso automático a calcular.";
  }

  if (!Number.isFinite(startsAtMs)) {
    return "A política será definida no momento da solicitação.";
  }

  const hoursUntilStart = (startsAtMs - nowMs) / ONE_HOUR_MS;
  if (hoursUntilStart >= cancellationPolicy.freeUntilHours) {
    return `Cancelamento com ${cancellationPolicy.freeUntilHours}h ou mais pode permitir reembolso integral ou reagendamento, quando aplicável. O valor final será informado ao concluir a solicitação.`;
  }

  if (Number.isFinite(endsAtMs) && nowMs > endsAtMs) {
    return "Não comparecimento não gera obrigação de reembolso. Situações excepcionais podem ser analisadas pelo TES.";
  }

  return "Cancelamento com menos de 24h pode ser considerado desistência e não gera obrigação de reembolso. Situações excepcionais podem ser analisadas pelo TES.";
}

function getRefundState(
  cancellationDecision: PatientEncounterActionPolicyInput["cancellationDecision"],
  financialStatus: string | null,
): PatientEncounterActionPolicy["cancellation"]["refundState"] {
  if (!cancellationDecision) {
    if (financialStatus === SessionFinancialStatus.Paid) return "not_started";
    if (
      financialStatus === SessionFinancialStatus.Refunded ||
      financialStatus === SessionFinancialStatus.PartiallyRefunded
    ) {
      return financialStatus === SessionFinancialStatus.Refunded
        ? "full"
        : "partial";
    }

    return "not_applicable";
  }

  if (cancellationDecision.requiresManualReview) return "manual_review";
  if (cancellationDecision.refundAmountCents <= 0) return "none";
  if (financialStatus === SessionFinancialStatus.Refunded) return "full";
  if (financialStatus === SessionFinancialStatus.PartiallyRefunded) {
    return "partial";
  }

  return "pending";
}

function getCancellationTitle(
  cancellationDecision: PatientEncounterActionPolicyInput["cancellationDecision"],
  financialStatus: string | null,
) {
  if (cancellationDecision?.requiresManualReview) return "Reembolso em análise";
  if (financialStatus === SessionFinancialStatus.Refunded)
    return "Reembolso concluído";
  if (financialStatus === SessionFinancialStatus.PartiallyRefunded) {
    return "Reembolso parcial";
  }
  if (cancellationDecision) return "Cancelamento registrado";

  return "Política de cancelamento";
}

function isTerminalBookingStatus(status: string) {
  return (
    status === BookingStatus.Completed ||
    status === BookingStatus.CancelledByPatient ||
    status === BookingStatus.CancelledByTherapist ||
    status === BookingStatus.NoShowPatient ||
    status === BookingStatus.NoShowTherapist ||
    status === BookingStatus.Refunded
  );
}

function formatCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueCents / 100);
}
