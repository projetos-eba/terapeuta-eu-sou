export type RetainedCancellationFinalizationInput = {
  bookingId: string;
  cancelledAt: string;
  decisionId: string;
  internalReason: string;
  paymentId: string;
};

export type RetainedCancellationFinalizationOperations = {
  markBookingCancellation: (input: {
    bookingId: string;
    cancelledAt: string;
    internalReason: string;
  }) => Promise<void>;
  markDecisionProcessed: (decisionId: string) => Promise<void>;
  refreshTransferEligibility: (paymentId: string) => Promise<void>;
  transitionBookingCancellation: () => Promise<void>;
  updatePayment: (input: {
    cancelledAt: string;
    paymentId: string;
  }) => Promise<void>;
};

export async function finalizeRetainedCancellation(
  input: RetainedCancellationFinalizationInput,
  operations: RetainedCancellationFinalizationOperations,
) {
  await operations.transitionBookingCancellation();
  await operations.updatePayment({
    cancelledAt: input.cancelledAt,
    paymentId: input.paymentId,
  });
  await operations.markBookingCancellation({
    bookingId: input.bookingId,
    cancelledAt: input.cancelledAt,
    internalReason: input.internalReason,
  });
  await operations.markDecisionProcessed(input.decisionId);
  await operations.refreshTransferEligibility(input.paymentId);
}
