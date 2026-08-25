export type AttemptEventStatus =
  | "canceled"
  | "failed"
  | "paid"
  | "processing";

export function shouldApplySessionAttemptEvent(input: {
  currentCheckoutSessionId: string | null;
  eventCheckoutSessionId: string | null;
  status: AttemptEventStatus;
}) {
  if (input.status === "paid") return true;
  if (!input.eventCheckoutSessionId) return false;
  return input.eventCheckoutSessionId === input.currentCheckoutSessionId;
}
