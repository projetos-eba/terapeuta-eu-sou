import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTherapistSearchParams } from "./filters";
import { getPublicTherapistSearchResult } from "./supabase";

const filters = parseTherapistSearchParams();

describe("public therapist search fallback contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not activate demo data in development without explicit flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await getPublicTherapistSearchResult(filters);

    expect(result.status).toBe("degraded");
    expect(result.source).toBe("live");
    expect(result.therapists).toEqual([]);
    expect(result.degradedReason).toBe("configuration_missing");
  });

  it("allows demo data only with explicit server-side flag outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TES_ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const result = await getPublicTherapistSearchResult(filters);

    expect(result.status).toBe("demo");
    expect(result.source).toBe("demo");
    expect(result.therapists.length).toBeGreaterThan(0);
  });

  it("treats zero live rows as an empty result, not as demo", async () => {
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

    const result = await getPublicTherapistSearchResult(filters);

    expect(result.status).toBe("empty");
    expect(result.source).toBe("live");
    expect(result.therapists).toEqual([]);
  });

  it("returns degraded state on query failure without leaking the raw error", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const result = await getPublicTherapistSearchResult(filters);
    const loggedPayload = JSON.parse(String(warn.mock.calls[0]?.[0] ?? "{}"));

    expect(result.status).toBe("degraded");
    expect(result.source).toBe("live");
    expect(result.therapists).toEqual([]);
    expect(loggedPayload).toMatchObject({
      event: "public_data_query_failed",
      operation: "public_therapist_search",
      reason: "query_failed",
    });
    expect(JSON.stringify(loggedPayload)).not.toContain("publishable");
    expect(JSON.stringify(loggedPayload)).not.toContain("example.supabase.co");
  });
});
