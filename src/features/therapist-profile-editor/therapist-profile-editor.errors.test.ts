import { describe, expect, it } from "vitest";

import { normalizeTherapistProfileError } from "./therapist-profile-editor.errors";

describe("therapist profile errors", () => {
  it("keeps the active-review message in product language", () => {
    expect(
      normalizeTherapistProfileError({
        error: {
          code: "PROFILE_REVIEW_IN_PROGRESS",
        },
        ok: false,
      }),
    ).toEqual({
      code: "PROFILE_REVIEW_IN_PROGRESS",
      message:
        "Seu perfil já está em análise. Atualize a página para acompanhar a situação.",
      requestId: undefined,
    });
  });
});
