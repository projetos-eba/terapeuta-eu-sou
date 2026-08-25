import { DomainError } from "./http.ts";

export type FinanceTestControlConfig = {
  financeTestControlsEnabled: boolean;
  stripeMode: "live" | "test";
};

export function resolveFinanceOperationInstant(input: {
  config: FinanceTestControlConfig;
  defaultInstant: string;
  fieldName: string;
  override?: unknown;
}) {
  if (input.override === undefined || input.override === null) {
    return requireIsoInstant(input.defaultInstant, input.fieldName);
  }

  if (
    !input.config.financeTestControlsEnabled ||
    input.config.stripeMode !== "test"
  ) {
    throw new DomainError(
      "finance_test_control_not_allowed",
      403,
      "Controle temporal financeiro permitido somente em ambiente de teste autorizado.",
    );
  }

  if (typeof input.override !== "string") {
    throw new DomainError(
      `${input.fieldName}_invalid`,
      422,
      "Data de controle invalida.",
    );
  }

  return requireIsoInstant(input.override, input.fieldName);
}

export type StripeTransferCreateParams = {
  amount: number;
  currency: "brl";
  destination: string;
  expand: ["destination_payment.balance_transaction"];
  metadata: {
    payout_batch_id: string;
    payout_batch_item_id: string;
    system: "tes";
    tes_session_id: string;
    tes_session_payment_id: string;
    tes_therapist_id: string;
  };
  source_transaction: string;
  transfer_group: string;
};

export function buildSessionTransferCreateParams(input: {
  amountCents: number;
  batchId: string;
  bookingId: string;
  destination: string;
  sessionPaymentId: string;
  sourceChargeId: string;
  therapistProfileId: string;
  itemId: string;
}): StripeTransferCreateParams {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError(
      "invalid_transfer_amount",
      422,
      "Valor de repasse invalido.",
    );
  }

  for (const [field, value] of Object.entries({
    batchId: input.batchId,
    bookingId: input.bookingId,
    destination: input.destination,
    itemId: input.itemId,
    sessionPaymentId: input.sessionPaymentId,
    sourceChargeId: input.sourceChargeId,
    therapistProfileId: input.therapistProfileId,
  })) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainError(
        `invalid_${field}`,
        422,
        "Dados de repasse invalidos.",
      );
    }
  }

  return {
    amount: input.amountCents,
    currency: "brl",
    destination: input.destination,
    expand: ["destination_payment.balance_transaction"],
    metadata: {
      payout_batch_id: input.batchId,
      payout_batch_item_id: input.itemId,
      system: "tes",
      tes_session_id: input.bookingId,
      tes_session_payment_id: input.sessionPaymentId,
      tes_therapist_id: input.therapistProfileId,
    },
    source_transaction: input.sourceChargeId,
    transfer_group: `tes_booking_${input.bookingId}`,
  };
}

export function isSessionPaymentTransferable(input: {
  financialStatus: string;
  refundPending: boolean;
  stripeChargeId: string | null;
  transferStatus: string;
}) {
  return (
    Boolean(input.stripeChargeId) &&
    input.financialStatus === "paid" &&
    !input.refundPending &&
    (input.transferStatus === "batched" ||
      input.transferStatus === "transfer_pending")
  );
}

function requireIsoInstant(value: string, fieldName: string) {
  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) {
    throw new DomainError(
      `${fieldName}_invalid`,
      422,
      "Data de controle invalida.",
    );
  }

  return new Date(time).toISOString();
}
