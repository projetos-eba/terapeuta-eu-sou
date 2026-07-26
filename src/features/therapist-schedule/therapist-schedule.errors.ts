export type TherapistScheduleErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "invalid_payload"
  | "invalid_timezone"
  | "overlapping_rules"
  | "session_expired"
  | "unavailable"
  | "version_conflict";

export class TherapistScheduleContractError extends Error {
  constructor() {
    super("Therapist schedule payload does not match contract v1.");
    this.name = "TherapistScheduleContractError";
  }
}
