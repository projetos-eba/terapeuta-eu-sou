export type TherapistPostSessionAction =
  | "confirm"
  | "room"
  | "submitted"
  | "unavailable";

export function getTherapistPostSessionAction(input: {
  endsAt: string;
  feedbackStatus: string;
  now?: number;
}): TherapistPostSessionAction {
  const endsAt = Date.parse(input.endsAt);
  const now = input.now ?? Date.now();

  if (!Number.isFinite(endsAt) || endsAt > now) {
    return "room";
  }

  if (input.feedbackStatus === "eligible") return "confirm";
  if (input.feedbackStatus === "submitted") return "submitted";

  return "unavailable";
}
