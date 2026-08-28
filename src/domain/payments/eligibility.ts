export type SessionFinancialStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "canceled"
  | "partially_refunded"
  | "refunded"
  | "disputed";

export type SessionServiceStatus =
  | "scheduled"
  | "occurred_pending_confirmation"
  | "confirmed_bilateral"
  | "confirmed_by_patient_review"
  | "confirmed_by_therapist"
  | "auto_confirmed"
  | "contested"
  | "canceled"
  | "not_performed";

export type SessionTransferStatus =
  | "not_eligible"
  | "waiting_confirmation"
  | "waiting_safety_period"
  | "eligible"
  | "batched"
  | "transfer_pending"
  | "transferred"
  | "blocked"
  | "reversed"
  | "failed";

export type EligibilityInput = {
  adminBlockedAt?: Date | null;
  alreadyInActiveBatch?: boolean;
  connectTransfersActive: boolean;
  disputedAt?: Date | null;
  financialStatus: SessionFinancialStatus;
  internalContestedAt?: Date | null;
  now: Date;
  refundPending?: boolean;
  serviceConfirmedAt?: Date | null;
  serviceStatus: SessionServiceStatus;
  therapistAmountCents: number;
  transferredAt?: Date | null;
};

export type EligibilityResult = {
  eligibleAt: Date | null;
  reason: string;
  status: SessionTransferStatus;
};

const SAFETY_PERIOD_DAYS = 7;

export function evaluateSessionTransferEligibility(
  input: EligibilityInput,
): EligibilityResult {
  if (input.transferredAt) {
    return {
      eligibleAt: null,
      reason: "already_transferred",
      status: "transferred",
    };
  }

  if (input.alreadyInActiveBatch) {
    return { eligibleAt: null, reason: "already_batched", status: "batched" };
  }

  if (input.financialStatus === "disputed" || input.disputedAt) {
    return { eligibleAt: null, reason: "disputed", status: "blocked" };
  }

  if (input.adminBlockedAt || input.internalContestedAt) {
    return {
      eligibleAt: null,
      reason: "blocked_or_contested",
      status: "blocked",
    };
  }

  if (input.refundPending || input.financialStatus === "refunded") {
    return { eligibleAt: null, reason: "refund", status: "blocked" };
  }

  if (
    input.financialStatus !== "paid" &&
    input.financialStatus !== "partially_refunded"
  ) {
    return {
      eligibleAt: null,
      reason: "payment_not_confirmed",
      status: "not_eligible",
    };
  }

  if (!isServiceConfirmed(input.serviceStatus) || !input.serviceConfirmedAt) {
    return {
      eligibleAt: null,
      reason: "service_not_confirmed",
      status: "waiting_confirmation",
    };
  }

  if (!input.connectTransfersActive) {
    return { eligibleAt: null, reason: "connect_not_ready", status: "blocked" };
  }

  if (input.therapistAmountCents <= 0) {
    return {
      eligibleAt: null,
      reason: "non_positive_transfer_amount",
      status: "not_eligible",
    };
  }

  const eligibleAt = addDays(input.serviceConfirmedAt, SAFETY_PERIOD_DAYS);

  if (input.now < eligibleAt) {
    return {
      eligibleAt,
      reason: "waiting_safety_period",
      status: "waiting_safety_period",
    };
  }

  return { eligibleAt, reason: "eligible", status: "eligible" };
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isServiceConfirmed(status: SessionServiceStatus) {
  return (
    status === "confirmed_bilateral" ||
    status === "confirmed_by_patient_review" ||
    status === "confirmed_by_therapist" ||
    status === "auto_confirmed"
  );
}
