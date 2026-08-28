export const REAL_EMAIL_SEND_INTERVAL_MS = 120_000;

export function resolveSingleRealEmailActionKey(
  requested: string | undefined,
  supportedActionKeys: readonly string[],
) {
  const actionKeys = (requested ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (actionKeys.length !== 1) {
    throw new Error("EMAIL_E2E_ACTION_KEYS must contain exactly one action key.");
  }

  const [actionKey] = actionKeys;
  if (!supportedActionKeys.includes(actionKey)) {
    throw new Error(
      `EMAIL_E2E_ACTION_KEYS contains an unsupported action: ${actionKey}.`,
    );
  }

  return actionKey;
}

export function realEmailCooldownRemainingMs(
  attemptedAt: string,
  nowMs = Date.now(),
) {
  const attemptedAtMs = Date.parse(attemptedAt);
  if (!Number.isFinite(attemptedAtMs)) {
    throw new Error("The persistent real email send gate is invalid.");
  }

  return Math.max(
    0,
    REAL_EMAIL_SEND_INTERVAL_MS - (nowMs - attemptedAtMs),
  );
}
