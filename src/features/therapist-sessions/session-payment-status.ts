import { BookingStatus, SessionFinancialStatus } from "@/domain/tes";

import type { SessionPresentation } from "@/features/bookings";

type TherapistSessionPaymentStatus = {
  description: string;
  label: string;
  tone: "brand" | "success" | "warning";
};

export function getTherapistSessionPaymentStatus({
  financialStatus,
  now = new Date(),
  sessionState,
  startsAt,
}: {
  bookingStatus?: BookingStatus;
  financialStatus: SessionFinancialStatus | null;
  now?: Date;
  sessionState: SessionPresentation["state"];
  startsAt?: string;
}): TherapistSessionPaymentStatus {
  const startsAtMs = startsAt ? Date.parse(startsAt) : Number.NaN;
  const paymentScheduled =
    sessionState === "reserved" ||
    (sessionState === "reschedule_requested" &&
      financialStatus === SessionFinancialStatus.Pending &&
      Number.isFinite(startsAtMs) &&
      startsAtMs - now.getTime() > 24 * 60 * 60_000);

  if (paymentScheduled) {
    return {
      description: "A cobrança será realizada 24 horas antes da sessão.",
      label: "Agendado",
      tone: "brand",
    };
  }

  const presentations: Partial<
    Record<SessionFinancialStatus, TherapistSessionPaymentStatus>
  > = {
    [SessionFinancialStatus.Canceled]: {
      description: "Esta sessão foi cancelada.",
      label: "Cancelado",
      tone: "warning",
    },
    [SessionFinancialStatus.Disputed]: {
      description: "Há uma ocorrência de pagamento em análise.",
      label: "Em análise",
      tone: "warning",
    },
    [SessionFinancialStatus.Failed]: {
      description: "Há uma pendência de pagamento para esta sessão.",
      label: "Não confirmado",
      tone: "warning",
    },
    [SessionFinancialStatus.Paid]: {
      description: "O pagamento desta sessão foi confirmado.",
      label: "Confirmado",
      tone: "success",
    },
    [SessionFinancialStatus.PartiallyRefunded]: {
      description: "Há um reembolso parcial registrado para esta sessão.",
      label: "Reembolso parcial",
      tone: "warning",
    },
    [SessionFinancialStatus.Pending]: {
      description: "A confirmação do pagamento ainda está em andamento.",
      label: "Aguardando confirmação",
      tone: "warning",
    },
    [SessionFinancialStatus.Processing]: {
      description: "A confirmação do pagamento ainda está em andamento.",
      label: "Em processamento",
      tone: "warning",
    },
    [SessionFinancialStatus.Refunded]: {
      description: "Um reembolso foi registrado para esta sessão.",
      label: "Reembolsado",
      tone: "warning",
    },
  };

  return financialStatus && presentations[financialStatus]
    ? presentations[financialStatus]
    : {
        description: "A confirmação de pagamento ainda não está disponível.",
        label: "Aguardando confirmação",
        tone: "warning",
      };
}
