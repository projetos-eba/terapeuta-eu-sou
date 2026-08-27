export const MONEY_SCALE_BPS = 10000;
export const DEFAULT_PLATFORM_COMMISSION_BPS = 1500;

export function calculateCommissionSnapshot(input: {
  grossAmountCents: number;
  platformCommissionBps?: number;
}) {
  const grossAmountCents = assertNonNegativeInteger(input.grossAmountCents);
  const platformCommissionBps =
    input.platformCommissionBps ?? DEFAULT_PLATFORM_COMMISSION_BPS;

  if (
    !Number.isInteger(platformCommissionBps) ||
    platformCommissionBps < 0 ||
    platformCommissionBps > MONEY_SCALE_BPS
  ) {
    throw new Error("INVALID_PLATFORM_COMMISSION_BPS");
  }

  const therapistAmountCents = Math.floor(
    (grossAmountCents * (MONEY_SCALE_BPS - platformCommissionBps)) /
      MONEY_SCALE_BPS,
  );

  return {
    grossAmountCents,
    platformCommissionBps,
    platformGrossCommissionCents: grossAmountCents - therapistAmountCents,
    therapistAmountCents,
  };
}

function assertNonNegativeInteger(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("INVALID_MONEY_AMOUNT");
  }

  return value;
}
