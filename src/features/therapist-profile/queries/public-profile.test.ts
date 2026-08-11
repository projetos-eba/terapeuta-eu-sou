import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-test-key",
    url: "https://example.supabase.co",
  }),
}));

vi.mock("@/lib/public-data-result", () => ({
  isPublicDemoDataEnabled: () => false,
  publicDataDegraded: (input: unknown) => ({
    ...((input as object) ?? {}),
    source: "live",
    status: "unavailable",
  }),
}));

import { getPublicTherapistProfileResult } from "./public-profile";

describe("public therapist profile query", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not cache availability and booking conflicts with profile content", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getPublicTherapistProfileResult("terapeuta-hml");

    const serviceCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("public_therapist_profile_services_v"),
    );
    const profileCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("public_therapist_profiles_v"),
    );

    expect(serviceCall?.[1]).toEqual(
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(serviceCall?.[1]).not.toHaveProperty("next");
    expect(profileCall?.[1]).toEqual(
      expect.objectContaining({
        next: { revalidate: 900, tags: ["therapist-profile"] },
      }),
    );
  });
});
