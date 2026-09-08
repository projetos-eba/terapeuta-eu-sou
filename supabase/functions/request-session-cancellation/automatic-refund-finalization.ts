export type AutomaticRefundFinalizationInput = {
  bookingId: string;
  cancelledAt: string;
  decisionId: string;
  grossAmountCents: number;
  internalReason: string;
  paymentId: string;
  refundAmountCents: number;
};

export type AutomaticRefundFinalizationOperations = {
  markBookingCancellation: (input: {
    bookingId: string;
    cancelledAt: string;
    internalReason: string;
  }) => Promise<void>;
  markDecisionProcessed: (decisionId: string) => Promise<void>;
  transitionBookingCancellation: () => Promise<void>;
  updatePayment: (input: {
    cancelledAt: string;
    financialStatus: "partially_refunded" | "refunded";
    paymentId: string;
  }) => Promise<void>;
};

export async function finalizeAutomaticRefund(
  input: AutomaticRefundFinalizationInput,
  operations: AutomaticRefundFinalizationOperations,
) {
  const financialStatus =
    input.refundAmountCents >= input.grossAmountCents
      ? "refunded"
      : "partially_refunded";

  // A full refund moves the booking to `refunded` through the authoritative
  // payment trigger. Trying to transition it afterwards would report a false
  // conflict even though Stripe and the database had completed the refund.
  if (financialStatus === "partially_refunded") {
    await operations.transitionBookingCancellation();
  }

  await operations.updatePayment({
    cancelledAt: input.cancelledAt,
    financialStatus,
    paymentId: input.paymentId,
  });
  await operations.markBookingCancellation({
    bookingId: input.bookingId,
    cancelledAt: input.cancelledAt,
    internalReason: input.internalReason,
  });
  await operations.markDecisionProcessed(input.decisionId);

  return financialStatus;
}
