import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapistPlan } from "@/domain/tes";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("./therapist-aura.queries", () => ({
  queryTherapistAuraSignals: queryMock,
}));

vi.mock("./therapist-aura.mappers", () => ({
  mapTherapistAuraSignals: vi.fn(),
}));

import { getTherapistAuraPage } from "./therapist-aura.service";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getTherapistAuraPage", () => {
  it("does not query Aura while the soft launch is disabled", async () => {
    vi.stubEnv("AURA_ENABLED", "false");

    await expect(
      getTherapistAuraPage({
        accessToken: "token",
        periodDays: 30,
        plan: TherapistPlan.PremiumPlus,
        profileId: "profile-id",
      }),
    ).resolves.toMatchObject({ code: "coming_soon", ok: false });

    expect(queryMock).not.toHaveBeenCalled();
  });

  it("does not query Aura without the Premium Plus entitlement", async () => {
    vi.stubEnv("AURA_ENABLED", "true");

    await expect(
      getTherapistAuraPage({
        accessToken: "token",
        periodDays: 30,
        plan: TherapistPlan.Premium,
        profileId: "profile-id",
      }),
    ).resolves.toMatchObject({ code: "forbidden", ok: false });

    expect(queryMock).not.toHaveBeenCalled();
  });
});
