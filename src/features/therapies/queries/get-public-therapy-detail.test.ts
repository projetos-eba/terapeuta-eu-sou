import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-test-key",
    url: "https://example.supabase.co",
  }),
}));

import { getPublicTherapyDetail } from "./get-public-therapy-detail";

describe("getPublicTherapyDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the catalog storage image when no dedicated hero was configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              approach_icon_key: "sparkles",
              approach_label: "Bem-estar",
              benefits: [],
              category_name: "Bem-estar",
              category_slug: "bem-estar",
              complementary_description: null,
              description: "DescriÃ§Ã£o editorial.",
              hero_focal_point: "center",
              hero_image_url: null,
              highlights: [],
              id: "therapy-1",
              image_url:
                "https://example.supabase.co/storage/v1/object/public/admin-public-media/therapies/teste.jpg",
              introduction: "ApresentaÃ§Ã£o.",
              name: "Terapia teste",
              safety_note: null,
              seo_description: null,
              seo_title: null,
              short_description: "Resumo.",
              slug: "terapia-teste",
              subtitle: "SubtÃ­tulo.",
              therapist_count: 0,
              visual_theme_key: "energy",
            },
          ]),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );

    const therapy = await getPublicTherapyDetail("terapia-teste");

    expect(therapy?.heroImageUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/admin-public-media/therapies/teste.jpg",
    );
  });

  it("keeps a dedicated hero image when it exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              approach_icon_key: null,
              approach_label: null,
              benefits: [],
              category_name: "Bem-estar",
              category_slug: "bem-estar",
              complementary_description: null,
              description: null,
              hero_focal_point: null,
              hero_image_url: "https://cdn.example.test/hero.jpg",
              highlights: [],
              id: "therapy-2",
              image_url: "https://cdn.example.test/card.jpg",
              introduction: null,
              name: "Terapia com hero",
              safety_note: null,
              seo_description: null,
              seo_title: null,
              short_description: "Resumo.",
              slug: "terapia-com-hero",
              subtitle: null,
              therapist_count: 0,
              visual_theme_key: null,
            },
          ]),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );

    const therapy = await getPublicTherapyDetail("terapia-com-hero");

    expect(therapy?.heroImageUrl).toBe("https://cdn.example.test/hero.jpg");
  });
});
