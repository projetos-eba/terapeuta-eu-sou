import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapTherapistServiceDatabaseError,
  validateTherapistServicesCommand,
} from "./service-command.ts";

const requestId = "a6000000-0000-4000-8000-000000000001";
const therapyId = "22222222-2222-4222-8222-222222222225";
const serviceId = "d1000000-0000-4000-8000-000000000001";

Deno.test("validates service creation with canonical therapy id", () => {
  const result = validateTherapistServicesCommand({
    action: "create",
    description: "Sessao responsavel e complementar.",
    durationMinutes: 60,
    priceCents: 12000,
    requestId,
    therapyId,
    title: "Reiki online",
  });

  assertEquals(result.action, "create");
  if (result.action === "create") {
    assertEquals(result.payload.therapyId, therapyId);
    assertEquals(result.payload.deliveryFormat, "online");
  }
});

Deno.test("rejects free-text therapy creation payloads", () => {
  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "create",
      durationMinutes: 60,
      priceCents: 12000,
      requestId,
      therapyName: "Nova terapia",
      title: "Servico livre",
    } as never),
  );
});

Deno.test("validates optimistic updates", () => {
  const result = validateTherapistServicesCommand({
    action: "update",
    expectedVersion: 3,
    isBookable: false,
    requestId,
    serviceId,
  });

  assertEquals(result.action, "update");
});

Deno.test("validates service transitions", () => {
  const result = validateTherapistServicesCommand({
    action: "pause",
    expectedVersion: 2,
    requestId,
    serviceId,
  });

  assertEquals(result.action, "pause");
});

Deno.test("rejects duplicated reorder ids", () => {
  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "reorder",
      requestId,
      serviceIds: [serviceId, serviceId],
    }),
  );
});

Deno.test("maps database idempotency conflicts", () => {
  const result = mapTherapistServiceDatabaseError(
    new SupabaseHttpError(400, "THERAPIST_SERVICE_IDEMPOTENCY_CONFLICT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "idempotency_conflict");
  assertEquals((result as DomainError).status, 409);
});

Deno.test("maps unavailable canonical therapy errors", () => {
  const result = mapTherapistServiceDatabaseError(
    new SupabaseHttpError(400, "THERAPY_NOT_AVAILABLE_FOR_SERVICE"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "therapy_not_available");
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "invalid_payload");
}
