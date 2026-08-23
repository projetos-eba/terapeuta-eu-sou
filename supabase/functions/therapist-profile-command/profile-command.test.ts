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
      bioIllustrationId: "organic_flow",
      publicProfileTheme: "natural",
      publicName: "Ana Oliveira",
      reflections: [{ minutesToRead: 3, title: "Presenca no cotidiano" }],
      shortIntro: "Acolhimento online com linguagem clara.",
    },
    requestId,
  });

  assertEquals(result.action, "save_draft");
  if (result.action === "save_draft") {
    assertEquals(result.payload.publicName, "Ana Oliveira");
    assertEquals(result.payload.publicProfileTheme, "natural");
    assertEquals(result.payload.bioIllustrationId, "organic_flow");
    assertEquals(result.payload.videoProvider, "external");
  }
});

Deno.test("accepts the new Premium theme IDs at the Edge contract boundary", () => {
  const result = validateTherapistProfileCommand({
    action: "save_draft",
    expectedVersion: 3,
    payload: {
      essenceBody: "Minha pratica combina presenca, clareza e cuidado.",
      publicName: "Ana Oliveira",
      publicProfileTheme: "essencial_editorial",
      shortIntro: "Acolhimento online com linguagem clara.",
    },
    requestId,
  });

  if (result.action === "save_draft") {
    assertEquals(result.payload.publicProfileTheme, "essencial_editorial");
  }
});

Deno.test("validates slug availability and update commands", () => {
  assertEquals(
    validateTherapistProfileCommand({
      action: "check_slug_availability",
      slug: "Ana Presença",
    }),
    { action: "check_slug_availability", slug: "Ana Presença" },
  );
  assertEquals(
    validateTherapistProfileCommand({
      action: "update_slug",
      expectedVersion: 4,
      requestId,
      slug: "Ana Presença",
    }),
    {
      action: "update_slug",
      expectedVersion: 4,
      requestId,
      slug: "Ana Presença",
    },
  );
});

Deno.test("maps slug collisions without exposing another therapist", () => {
  const result = mapTherapistProfileDatabaseError(
    new SupabaseHttpError(400, "SLUG_TAKEN"),
  );
  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "SLUG_TAKEN");
  assertEquals((result as DomainError).status, 409);
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

Deno.test(
  "accepts YouTube links and rejects arbitrary external video hosts",
  () => {
    const valid = validateTherapistProfileCommand({
      action: "save_draft",
      expectedVersion: 1,
      payload: {
        publicName: "Ana Oliveira",
        videoProvider: "youtube",
        videoUrl: "https://www.youtube.com/watch?v=example",
      },
      requestId,
    });
    assertEquals(valid.action, "save_draft");

    assertDomainError(() =>
      validateTherapistProfileCommand({
        action: "save_draft",
        expectedVersion: 1,
        payload: {
          publicName: "Ana Oliveira",
          videoProvider: "external",
          videoUrl: "https://example.test/video",
        },
        requestId,
      }),
    );
  },
);

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
