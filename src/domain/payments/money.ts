export const MONEY_SCALE_BPS = 10_000;
export const DEFAULT_PLATFORM_COMMISSION_BPS = 1_500;
export const DEFAULT_CURRENCY = "BRL";

export type CommissionSnapshot = {
  currency: string;
  grossAmountCents: number;
  platformCommissionBps: number;
  platformGrossCommissionCents: number;
  therapistAmountCents: number;
};

export function calculateCommissionSnapshot(input: {
  currency?: string;
  grossAmountCents: number;
  platformCommissionBps?: number;
}): CommissionSnapshot {
  const grossAmountCents = assertNonNegativeInteger(
    input.grossAmountCents,
    "grossAmountCents",
  );
  const platformCommissionBps = assertBps(
    input.platformCommissionBps ?? DEFAULT_PLATFORM_COMMISSION_BPS,
  );
  const therapistBps = MONEY_SCALE_BPS - platformCommissionBps;
  const therapistAmountCents = Math.floor(
    (grossAmountCents * therapistBps) / MONEY_SCALE_BPS,
  );

  return {
    currency: normalizeCurrency(input.currency),
    grossAmountCents,
    platformCommissionBps,
    platformGrossCommissionCents: grossAmountCents - therapistAmountCents,
    therapistAmountCents,
  };
}

export function normalizeCurrency(currency = DEFAULT_CURRENCY) {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("INVALID_CURRENCY");
  }

  return normalized;
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }

  return value;
}

function assertBps(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > MONEY_SCALE_BPS) {
    throw new Error("INVALID_PLATFORM_COMMISSION_BPS");
  }

  return value;
}
