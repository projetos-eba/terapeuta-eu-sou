import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "./http.ts";
import { assertLegacySessionFinancialCommand } from "./session-flow-compatibility.ts";

Deno.test("legacy payment commands remain available to V9 bookings", () => {
  assertEquals(assertLegacySessionFinancialCommand("v9"), undefined);
  assertEquals(assertLegacySessionFinancialCommand(null), undefined);
});

Deno.test("legacy cancellation and rescheduling fail closed for V10", () => {
  const error = assertThrows(
    () => assertLegacySessionFinancialCommand("v10"),
    DomainError,
  );
  assertEquals(error.code, "session_financial_command_not_available");
  assertEquals(error.status, 409);
  assertEquals(
    error.message,
    "Para alterar este encontro, fale com nossa equipe de suporte.",
  );
  assertThrows(
    () => assertLegacySessionFinancialCommand("unsupported_future_version"),
    DomainError,
  );
});
