export type RecoverableCaptureAction =
  | "cancel_authorization"
  | "capture_authorization"
  | "keep_blocked"
  | "reconcile_canceled"
  | "reconcile_failed"
  | "reconcile_paid";

const AUTHORIZATION_RECOVERY_WINDOW_MS = 5 * 60_000;

export function resolveRecoverableCaptureAction(input: {
  nowMs: number;
  paymentIntentStatus: string;
  slotClaimedAt: string;
}): RecoverableCaptureAction {
  if (input.paymentIntentStatus === "canceled") return "reconcile_canceled";
  if (input.paymentIntentStatus === "requires_payment_method") {
    return "reconcile_failed";
  }
  if (input.paymentIntentStatus === "succeeded") return "reconcile_paid";
  if (input.paymentIntentStatus !== "requires_capture") return "keep_blocked";

  const claimedAtMs = new Date(input.slotClaimedAt).getTime();
  if (!Number.isFinite(claimedAtMs)) return "keep_blocked";
  return input.nowMs - claimedAtMs > AUTHORIZATION_RECOVERY_WINDOW_MS
    ? "cancel_authorization"
    : "capture_authorization";
}
