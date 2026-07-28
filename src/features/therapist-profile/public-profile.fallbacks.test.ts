import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicTherapistProfileResult } from "./queries/public-profile";

describe("public therapist profile fallback contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not return a demo profile for missing Supabase config without flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await getPublicTherapistProfileResult("ana-oliveira");

    expect(result.status).toBe("degraded");
    expect(result.source).toBe("live");
  });

  it("returns demo profile with explicit server-side flag outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TES_ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const result = await getPublicTherapistProfileResult("ana-oliveira");

    expect(result.status).toBe("demo");
    expect(result.source).toBe("demo");
  });

  it("keeps unknown slugs as not_found even when demo mode is enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TES_ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const result = await getPublicTherapistProfileResult("nao-existe");

    expect(result.status).toBe("not_found");
    expect(result.source).toBe("live");
  });

  it("keeps unknown live slugs as not_found instead of falling back", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [],
        ok: true,
      }),
    );

    const result = await getPublicTherapistProfileResult("nao-existe");

    expect(result.status).toBe("not_found");
  });
});
