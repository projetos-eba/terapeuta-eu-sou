export type TherapistBlocksErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "invalid_filter"
  | "session_expired"
  | "unavailable";

export class TherapistBlocksContractError extends Error {
  constructor() {
    super("Therapist blocks payload does not match contract v1.");
    this.name = "TherapistBlocksContractError";
  }
}
