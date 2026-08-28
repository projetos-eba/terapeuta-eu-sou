import {
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapScheduleDatabaseError,
  type ScheduleCommandBody,
  validateScheduleCommand,
} from "./schedule-command.ts";

const serviceId = "d1000000-0000-4000-8000-000000000001";
const ruleId = "e1000000-0000-4000-8000-000000000001";

Deno.test("schedule command accepts a complete versioned payload", () => {
  const result = validateScheduleCommand(commandFixture());

  assertEquals(result.expectedVersion, 2);
  assertEquals(result.rules.length, 1);
  assertEquals(result.serviceSettings[0].serviceId, serviceId);
  assertEquals(result.timezone, "America/Sao_Paulo");
});

Deno.test("schedule command rejects an invalid optimistic version", () => {
  const error = assertThrows(
    () => validateScheduleCommand(commandFixture({ expectedVersion: 0 })),
    DomainError,
  );

  assertEquals(error.code, "invalid_schedule_payload");
  assertEquals(error.status, 422);
});

Deno.test("schedule command rejects reversed and out-of-range rules", () => {
  const reversed = commandFixture();
  reversed.rules = [
    {
      ...reversed.rules![0],
      endTime: "09:00",
      startTime: "10:00",
    },
  ];
  const invalidDay = commandFixture();
  invalidDay.rules = [{ ...invalidDay.rules![0], dayOfWeek: 7 }];

  assertEquals(
    assertThrows(
      () => validateScheduleCommand(reversed),
      DomainError,
    ).code,
    "invalid_availability_range",
  );
  assertEquals(
    assertThrows(
      () => validateScheduleCommand(invalidDay),
      DomainError,
    ).code,
    "invalid_availability_range",
  );
});

Deno.test("schedule command rejects duplicate rule identifiers", () => {
  const body = commandFixture();
  body.rules = [body.rules![0], { ...body.rules![0] }];

  const error = assertThrows(
    () => validateScheduleCommand(body),
    DomainError,
  );

  assertEquals(error.code, "duplicate_schedule_rule");
});

Deno.test("schedule command rejects retired general availability rules", () => {
  const body = commandFixture();
  body.rules = [
    { ...body.rules![0], serviceId: null as unknown as string },
  ];

  const error = assertThrows(
    () => validateScheduleCommand(body),
    DomainError,
  );

  assertEquals(error.code, "invalid_availability_range");
});

Deno.test("schedule command rejects duplicate service settings", () => {
  const body = commandFixture();
  body.serviceSettings = [
    body.serviceSettings![0],
    { ...body.serviceSettings![0] },
  ];

  const error = assertThrows(
    () => validateScheduleCommand(body),
    DomainError,
  );

  assertEquals(error.code, "duplicate_service_settings");
});

Deno.test("schedule command validates buffer and slot step boundaries", () => {
  const negativeBuffer = commandFixture();
  negativeBuffer.serviceSettings = [
    { ...negativeBuffer.serviceSettings![0], bufferBeforeMinutes: -1 },
  ];
  const zeroStep = commandFixture();
  zeroStep.serviceSettings = [
    { ...zeroStep.serviceSettings![0], slotStepMinutes: 0 },
  ];

  assertEquals(
    assertThrows(
      () => validateScheduleCommand(negativeBuffer),
      DomainError,
    ).code,
    "invalid_service_booking_settings",
  );
  assertEquals(
    assertThrows(
      () => validateScheduleCommand(zeroStep),
      DomainError,
    ).code,
    "invalid_service_booking_settings",
  );
});

Deno.test("schedule command maps safe database conflicts", () => {
  const versionConflict = mapScheduleDatabaseError(
    new SupabaseHttpError(400, "schedule_version_conflict"),
  );
  const overlap = mapScheduleDatabaseError(
    new SupabaseHttpError(400, "overlapping_availability_rule"),
  );

  assertEquals((versionConflict as DomainError).code, "schedule_version_conflict");
  assertEquals((versionConflict as DomainError).status, 409);
  assertEquals((overlap as DomainError).code, "overlapping_availability_rule");
  assertEquals((overlap as DomainError).status, 409);
});

Deno.test("schedule command maps forbidden ownership failures", () => {
  const error = mapScheduleDatabaseError(
    new SupabaseHttpError(403, "schedule_service_forbidden"),
  );

  assertEquals((error as DomainError).code, "schedule_forbidden");
  assertEquals((error as DomainError).status, 403);
});

Deno.test("schedule command preserves unknown errors", () => {
  const original = new Error("external failure");

  assertStrictEquals(mapScheduleDatabaseError(original), original);
});

function commandFixture(
  overrides: Partial<ScheduleCommandBody> = {},
): ScheduleCommandBody {
  return {
    expectedVersion: 2,
    requestId: "a3000000-0000-4000-8000-000000000001",
    rules: [
      {
        dayOfWeek: 1,
        endTime: "12:00",
        id: ruleId,
        isActive: true,
        serviceId,
        startTime: "09:00",
      },
    ],
    serviceSettings: [
      {
        bookingHorizonDays: 30,
        bufferAfterMinutes: 10,
        bufferBeforeMinutes: 10,
        minimumNoticeMinutes: 120,
        serviceId,
        slotStepMinutes: 30,
      },
    ],
    timezone: "America/Sao_Paulo",
    ...overrides,
  };
}
