import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapTherapistProfileDatabaseError,
  validateTherapistProfileCommand,
} from "./profile-command.ts";

const requestId = "a6000000-0000-4000-8000-000000000001";

Deno.test("validates therapist profile draft payloads", () => {
  const result = validateTherapistProfileCommand({
    action: "save_draft",
    expectedVersion: 3,
    payload: {
      bio: "Atendimento online com escuta responsavel.",
      essenceBody: "Minha pratica combina presenca, clareza e cuidado.",
      guideItems: [{ icon: "sparkles", label: "Clareza emocional" }],
      publicName: "Ana Oliveira",
      reflections: [{ minutesToRead: 3, title: "Presenca no cotidiano" }],
      shortIntro: "Acolhimento online com linguagem clara.",
    },
    requestId,
  });

  assertEquals(result.action, "save_draft");
  if (result.action === "save_draft") {
    assertEquals(result.payload.publicName, "Ana Oliveira");
    assertEquals(result.payload.videoProvider, "external");
  }
});

Deno.test("rejects invalid therapist profile mutations", () => {
  assertDomainError(() =>
    validateTherapistProfileCommand({
      action: "save_draft",
      expectedVersion: 0,
      payload: { publicName: "A" },
      requestId,
    }),
  );

  assertDomainError(() =>
    validateTherapistProfileCommand({
      action: "publish",
      expectedVersion: 1,
      requestId: "not-a-uuid",
    }),
  );
});

Deno.test("maps profile database conflicts", () => {
  const result = mapTherapistProfileDatabaseError(
    new SupabaseHttpError(400, "VERSION_CONFLICT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "VERSION_CONFLICT");
  assertEquals((result as DomainError).status, 409);
});

Deno.test("maps profile capability denials", () => {
  const result = mapTherapistProfileDatabaseError(
    new SupabaseHttpError(400, "CAPABILITY_NOT_ALLOWED: video"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "CAPABILITY_NOT_ALLOWED");
  assertEquals((result as DomainError).status, 403);
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "VALIDATION_ERROR");
}
