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
const themeId = "33333333-3333-4333-8333-333333333333";

Deno.test("validates service creation with canonical therapy id", () => {
  const result = validateTherapistServicesCommand({
    action: "create",
    description: "Sessao responsavel e complementar.",
    durationMinutes: 60,
    interestIds: [],
    priceCents: 12000,
    requestId,
    themeIds: [themeId],
    therapyId,
    title: "Reiki online",
  });

  assertEquals(result.action, "create");
  if (result.action === "create") {
    assertEquals(result.payload.therapyId, therapyId);
    assertEquals(result.payload.deliveryFormat, "online");
  }
});

Deno.test("rejects non-online delivery formats on creation", () => {
  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "create",
      deliveryFormat: "in_person",
      description: "Sessao responsavel e complementar.",
      durationMinutes: 60,
      priceCents: 12000,
      requestId,
      therapyId,
      title: "Reiki online",
    }),
  );

  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "create",
      deliveryFormat: "hybrid",
      description: "Sessao responsavel e complementar.",
      durationMinutes: 60,
      priceCents: 12000,
      requestId,
      therapyId,
      title: "Reiki online",
    }),
  );
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

Deno.test("rejects service descriptions longer than 180 characters", () => {
  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "create",
      description: "x".repeat(181),
      durationMinutes: 60,
      priceCents: 12000,
      requestId,
      themeIds: [themeId],
      therapyId,
      title: "Reiki online",
    }),
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

Deno.test("accepts only whole service durations from 20 to 120 minutes", () => {
  for (const durationMinutes of [20, 120]) {
    const result = validateTherapistServicesCommand({
      action: "create",
      durationMinutes,
      interestIds: [],
      priceCents: 12000,
      requestId,
      themeIds: [themeId],
      therapyId,
      title: "Reiki online",
    });

    assertEquals(result.action, "create");
  }

  for (const durationMinutes of [19, 121, 20.5]) {
    assertDomainError(() =>
      validateTherapistServicesCommand({
        action: "create",
        durationMinutes,
        interestIds: [],
        priceCents: 12000,
        requestId,
        themeIds: [themeId],
        therapyId,
        title: "Reiki online",
      }),
    );
  }
});

Deno.test("rejects out-of-range service durations on updates", () => {
  for (const durationMinutes of [19, 121, 20.5]) {
    assertDomainError(() =>
      validateTherapistServicesCommand({
        action: "update",
        durationMinutes,
        expectedVersion: 3,
        requestId,
        serviceId,
      }),
    );
  }
});

Deno.test("rejects non-online delivery format updates", () => {
  assertDomainError(() =>
    validateTherapistServicesCommand({
      action: "update",
      deliveryFormat: "hybrid",
      expectedVersion: 3,
      requestId,
      serviceId,
    }),
  );
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
