import { afterEach, describe, expect, it, vi } from "vitest";

const dismissMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("./therapist-aura.queries", () => ({
  dismissTherapistAuraSignal: dismissMock,
}));

import { dismissAuraRecommendationAction } from "./therapist-aura.actions";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("dismissAuraRecommendationAction", () => {
  it("returns the soft-launch state without calling the Aura RPC", async () => {
    vi.stubEnv("AURA_ENABLED", "false");

    await expect(
      dismissAuraRecommendationAction({ status: "idle" }, new FormData()),
    ).resolves.toEqual({
      message: "A Assessora Aura estará disponível em breve.",
      status: "error",
    });

    expect(dismissMock).not.toHaveBeenCalled();
  });
});
