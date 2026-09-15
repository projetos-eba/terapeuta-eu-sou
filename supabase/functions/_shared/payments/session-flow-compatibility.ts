import { DomainError } from "./http.ts";

/** Keep legacy financial commands from mutating an unimplemented V10 lifecycle. */
export function assertLegacySessionFinancialCommand(
  paymentFlowVersion: string | null | undefined,
): void {
  if (paymentFlowVersion && paymentFlowVersion !== "v9") {
    throw new DomainError(
      "session_financial_command_not_available",
      409,
      "Para alterar este encontro, fale com nossa equipe de suporte.",
    );
  }
}
