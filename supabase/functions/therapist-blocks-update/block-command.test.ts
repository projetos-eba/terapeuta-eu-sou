import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { mapBlockDatabaseError, validateBlockCommand } from "./block-command.ts";

const requestId = "a4000000-0000-4000-8000-000000000001";

Deno.test("validates a timezone-safe recurring block", () => {
  const result = validateBlockCommand({
    action: "create",
    allDay: false,
    endTime: "18:00",
    reason: "Formacao",
    reasonCode: "training",
    recurrenceEndsOn: "2026-08-28",
    recurrenceFrequency: "weekly",
    requestId,
    serviceId: null,
    startTime: "14:00",
    startsOn: "2026-07-31",
    timezone: "America/Sao_Paulo",
  });

  assertEquals(result.action, "create");
  if (result.action === "create") {
    assertEquals(result.recurrenceFrequency, "weekly");
    assertEquals(result.reason, "Formacao");
  }
});

Deno.test("requires null clocks for all-day blocks", () => {
  assertDomainError(() =>
    validateBlockCommand({
      action: "create",
      allDay: true,
      endTime: "18:00",
      reason: null,
      reasonCode: "personal",
      recurrenceEndsOn: "2026-07-31",
      recurrenceFrequency: "none",
      requestId,
      serviceId: null,
      startTime: "09:00",
      startsOn: "2026-07-31",
      timezone: "America/Sao_Paulo",
    })
  );
});

Deno.test("rejects reversed partial ranges", () => {
  assertDomainError(() =>
    validateBlockCommand({
      action: "create",
      allDay: false,
      endTime: "09:00",
      reason: null,
      reasonCode: "other",
      recurrenceEndsOn: "2026-07-31",
      recurrenceFrequency: "none",
      requestId,
      serviceId: null,
      startTime: "10:00",
      startsOn: "2026-07-31",
      timezone: "America/Sao_Paulo",
    })
  );
});

Deno.test("validates occurrence and series cancellation", () => {
  const result = validateBlockCommand({
    action: "cancel",
    blockId: "a4100000-0000-4000-8000-000000000001",
    expectedScheduleVersion: 3,
    requestId,
    scope: "series",
  });

  assertEquals(result.action, "cancel");
  if (result.action === "cancel") assertEquals(result.scope, "series");
});

Deno.test("only accepts keep_booking as impact resolution", () => {
  const result = validateBlockCommand({
    action: "resolve_impact",
    impactId: "a4200000-0000-4000-8000-000000000001",
    requestId,
    resolution: "keep_booking",
  });

  assertEquals(result.action, "resolve_impact");
});

Deno.test("maps optimistic schedule conflicts", () => {
  const result = mapBlockDatabaseError(
    new SupabaseHttpError(400, "schedule_version_conflict"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 409);
  assertEquals((result as DomainError).code, "schedule_version_conflict");
});

Deno.test("maps ownership failures without leaking database details", () => {
  const result = mapBlockDatabaseError(
    new SupabaseHttpError(400, "block_service_forbidden"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 403);
  assertEquals((result as DomainError).code, "block_forbidden");
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "invalid_block_payload");
}
