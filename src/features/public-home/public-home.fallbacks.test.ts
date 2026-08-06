import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicHomeData } from "./supabase";

describe("public home fallback contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not activate demo data without the explicit server-side flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await getPublicHomeData();

    expect(result.status).toBe("degraded");
    expect(result.source).toBe("supabase");
    expect(result.therapists).toEqual([]);
    expect(result.therapies).toEqual([]);
    expect(result.testimonials).toEqual([]);
    expect(result.reason).toBe("configuration_missing");
  });

  it("activates demo data only with the explicit flag outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TES_ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const result = await getPublicHomeData();

    expect(result.status).toBe("demo");
    expect(result.source).toBe("demo");
    expect(result.therapists.length).toBeGreaterThan(0);
    expect(result.therapies.length).toBeGreaterThan(0);
  });

  it("keeps zero live therapists as an honest empty state", async () => {
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

    const result = await getPublicHomeData();

    expect(result.status).toBe("empty");
    expect(result.source).toBe("supabase");
    expect(result.therapists).toEqual([]);
  });
});
