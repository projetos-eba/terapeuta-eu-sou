import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "public-test-key",
    url: "https://supabase.test",
  }),
}));

import { queryTherapistSettings } from "./therapist-settings.queries";

const userId = "c1000000-0000-4000-8000-000000000001";
const therapistProfileId = "d1000000-0000-4000-8000-000000000001";

describe("queryTherapistSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the direct document-center response returned by the Edge Function", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/rest/v1/profiles?")) {
        return jsonResponse([
          {
            displayName: "Ana Oliveira",
            email: "ana@example.test",
            id: userId,
            phone: null,
            therapistProfile: {
              id: therapistProfileId,
              isAcceptingBookings: true,
              isPublic: true,
              plan: "premium",
              publicName: "Ana Oliveira",
              publicStatus: "published",
              slug: "ana-oliveira",
              status: "approved",
            },
          },
        ]);
      }
      if (url.includes("get_therapist_private_identity_v1")) {
        return jsonResponse({});
      }
      if (url.includes("therapist-private-documents")) {
        return jsonResponse({
          data: {
            documents: [],
            therapistProfileId,
            verificationStatus: "draft",
          },
          ok: true,
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      queryTherapistSettings({ accessToken: "session-token", userId }),
    ).resolves.toMatchObject({
      displayName: "Ana Oliveira",
      therapistProfile: { id: therapistProfileId, plan: "premium" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/rest/v1/profiles?"),
      ),
    ).toBe(true);
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
