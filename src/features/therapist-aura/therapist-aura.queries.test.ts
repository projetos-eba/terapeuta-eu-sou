import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-key",
    url: "https://project.supabase.co",
  }),
}));

import { queryTherapistAuraSignals } from "./therapist-aura.queries";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Aura queries", () => {
  it("does not issue an RPC request while the feature is disabled", async () => {
    vi.stubEnv("AURA_ENABLED", "false");
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryTherapistAuraSignals("token", 30)).rejects.toMatchObject({
      code: "coming_soon",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
