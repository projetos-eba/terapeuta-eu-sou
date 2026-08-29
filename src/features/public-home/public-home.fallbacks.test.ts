import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPublicHomeData,
  getPublicHomeFeaturedTherapistsPage,
} from "./supabase";

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

  it("reads the ordered Match theme array exposed by the therapy catalog", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);

      if (url.includes("public_therapies_v")) {
        return Promise.resolve(
          jsonResponse([
            {
              image_url: null,
              is_featured: true,
              name: "Reiki",
              short_description: "Prática de acolhimento.",
              slug: "reiki",
              theme_names: ["Emoções e bem-estar", "Propósito e direção"],
            },
          ]),
        );
      }

      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicHomeData();

    expect(result.therapies[0]?.themeName).toBe("Emoções e bem-estar");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("select=theme_names"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("select=theme_name,"),
      ),
    ).toBe(false);
  });

  it("prioritizes paid therapists and completes the page with Free profiles only below five paid profiles", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const url = String(input);

        if (url.includes("public_therapist_profiles_v")) {
          const paid = url.includes("plan=in.(premium,premium_plus)");
          const rows = paid
            ? [
                { plan: "premium", slug: "paid-one" },
                { plan: "premium_plus", slug: "paid-two" },
              ]
            : [
                { plan: "free", slug: "free-one" },
                { plan: "free", slug: "free-two" },
              ];
          return Promise.resolve(jsonResponse(rows, paid ? 2 : 2));
        }

        if (url.includes("public_home_therapists")) {
          return Promise.resolve(
            jsonResponse([
              therapistRow("paid-one"),
              therapistRow("paid-two"),
              therapistRow("free-one"),
              therapistRow("free-two"),
            ]),
          );
        }

        return Promise.resolve(jsonResponse([]));
      }),
    );

    const page = await getPublicHomeFeaturedTherapistsPage();

    expect(page.therapists.map((therapist) => therapist.slug)).toEqual([
      "paid-one",
      "paid-two",
      "free-one",
      "free-two",
    ]);
    expect(
      page.therapists.slice(0, 2).every((therapist) => therapist.isPremium),
    ).toBe(true);
    expect(
      page.therapists.slice(2).every((therapist) => !therapist.isPremium),
    ).toBe(true);
  });

  it("does not repeat the same public name and photo when separate records represent the same displayed professional", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const url = String(input);

        if (url.includes("public_therapist_profiles_v")) {
          return Promise.resolve(
            jsonResponse(
              [
                { plan: "premium", slug: "zoom-homologation-one" },
                { plan: "premium", slug: "zoom-homologation-two" },
              ],
              2,
            ),
          );
        }

        if (url.includes("public_home_therapists")) {
          return Promise.resolve(
            jsonResponse([
              therapistRow(
                "zoom-homologation-one",
                "Homologacao Zoom Terapeuta",
              ),
              therapistRow(
                "zoom-homologation-two",
                "Homologacao Zoom Terapeuta",
              ),
            ]),
          );
        }

        return Promise.resolve(jsonResponse([]));
      }),
    );

    const page = await getPublicHomeFeaturedTherapistsPage();

    expect(page.therapists).toHaveLength(1);
    expect(page.therapists[0]?.slug).toBe("zoom-homologation-one");
  });
});

function jsonResponse(body: unknown, total?: number) {
  return new Response(JSON.stringify(body), {
    headers:
      total === undefined ? undefined : { "content-range": `0-5/${total}` },
    status: 200,
  });
}

function therapistRow(slug: string, publicName = slug) {
  return {
    average_rating: 5,
    headline: null,
    photo_url: null,
    public_name: publicName,
    review_count: 1,
    service_price_from_cents: 10000,
    service_title: "Terapia online",
    slug,
  };
}
