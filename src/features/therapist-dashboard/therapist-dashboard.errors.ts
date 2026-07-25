export class TherapistDashboardError extends Error {
  constructor(
    readonly code:
      | "forbidden"
      | "invalid_response"
      | "session_expired"
      | "unavailable",
  ) {
    super("Não foi possível carregar o painel do terapeuta.");
  }
}
