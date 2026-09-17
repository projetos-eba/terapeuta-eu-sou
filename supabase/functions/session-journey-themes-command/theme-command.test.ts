import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import {
  mapSessionJourneyThemeDatabaseError,
  validateSessionJourneyThemeCommand,
} from "./theme-command.ts";
import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";

const bookingId = "96000000-0000-4000-8000-000000000001";
const requestId = "96000000-0000-4000-8000-000000000099";

Deno.test("validates one to three distinct journey themes with acknowledgement", () => {
  assertEquals(
    validateSessionJourneyThemeCommand({
      acknowledged: true,
      bookingId,
      requestId,
      themeKeys: ["work_and_career", "self_knowledge"],
    }),
    {
      acknowledged: true,
      bookingId,
      requestId,
      themeKeys: ["self_knowledge", "work_and_career"],
    },
  );
});

Deno.test("rejects missing acknowledgement, duplicate, free-text and over-limit selections", () => {
  for (const body of [
    {
      acknowledged: false,
      bookingId,
      requestId,
      themeKeys: ["self_knowledge"],
    },
    {
      acknowledged: true,
      bookingId,
      requestId,
      themeKeys: ["self_knowledge", "self_knowledge"],
    },
    {
      acknowledged: true,
      bookingId,
      requestId,
      themeKeys: ["outro tema livre"],
    },
    {
      acknowledged: true,
      bookingId,
      requestId,
      themeKeys: [
        "self_knowledge",
        "emotional_wellbeing",
        "communication",
        "family",
      ],
    },
  ]) {
    const error = assertThrows(() => validateSessionJourneyThemeCommand(body));
    assertEquals(error instanceof DomainError, true);
    assertEquals((error as DomainError).code, "VALIDATION_ERROR");
  }
});

Deno.test("maps an ineligible session to safe feedback-v2 product copy", () => {
  const error = mapSessionJourneyThemeDatabaseError(
    new SupabaseHttpError(409, "JOURNEY_THEME_SESSION_NOT_ELIGIBLE"),
  );

  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "UNAVAILABLE");
  assertEquals(
    (error as DomainError).message,
    "Os temas ficam disponíveis depois de uma avaliação positiva da sessão realizada.",
  );
  assertEquals((error as DomainError).message.includes(bookingId), false);
});
