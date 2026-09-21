export type TherapistPostSessionAction =
  | "automatically_confirmed"
  | "confirm"
  | "report_incident"
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
  if (input.feedbackStatus === "incident_only") return "report_incident";
  if (input.feedbackStatus === "automatically_confirmed") {
    return "automatically_confirmed";
  }
  if (input.feedbackStatus === "submitted") return "submitted";

  return "unavailable";
}
