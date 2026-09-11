import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRelatedTherapists,
  parseRelatedTherapistSort,
} from "./get-related-therapists";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getRelatedTherapists", () => {
  it("uses alphabetical order by default and normalizes the removed sort", () => {
    expect(parseRelatedTherapistSort()).toBe("az");
    expect(parseRelatedTherapistSort("relevance")).toBe("az");
    expect(parseRelatedTherapistSort("az")).toBe("az");
  });

  it("uses the published profile guide items instead of legacy profile tags", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://catalog.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("get_public_therapy_therapists_v1")) {
        return Response.json([
          {
            average_rating: 5,
            completed_session_count: 2,
            matching_interest_count: 0,
            matching_service_theme_count: 0,
            next_slot_at: null,
            photo_url: null,
            public_name: "Ana Oliveira",
            review_count: 1,
            service_description: "Atendimento acolhedor.",
            slug: "ana-oliveira",
            tags: ["Tag legada"],
            therapist_headline: "Terapeuta TES",
          },
        ]);
      }

      if (url.includes("public_therapist_profile_content_v")) {
        return Response.json([
          {
            guide_items: [
              { label: "Autoconhecimento" },
              { label: "Espiritualidade" },
              { label: "Autoconhecimento" },
              { label: "" },
            ],
            slug: "ana-oliveira",
          },
        ]);
      }

      return Response.json([{ plan: "premium", slug: "ana-oliveira" }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRelatedTherapists({
      slug: "reiki",
      sort: "az",
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          guideThemes: ["Autoconhecimento", "Espiritualidade"],
          isPremium: true,
        }),
      ],
    });
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).includes("public_therapist_profile_content_v"),
    )).toBe(true);
  });
});
