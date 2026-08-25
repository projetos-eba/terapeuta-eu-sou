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

  it("uses the therapist presentation instead of the service description", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [
          {
            average_rating: 4.8,
            city: "São Paulo",
            duration_minutes: 50,
            has_video: false,
            highlight: "Perfil Verificado",
            highlight_tone: "verified",
            next_slot_at: null,
            photo_url: null,
            public_name: "Ana Oliveira",
            review_count: 0,
            review_quote: null,
            search_text: "Ana Oliveira apresentação Reiki",
            service_description: "Descrição da oferta de Reiki.",
            service_id: "service-1",
            service_price_cents: 12000,
            service_title: "Reiki online",
            slug: "ana-oliveira",
            state: "SP",
            tags: ["Autoconhecimento"],
            theme_names: ["Autoconhecimento"],
            theme_slugs: ["autoconhecimento"],
            therapist_headline: "Acolhimento online com escuta cuidadosa.",
            therapy_id: "therapy-1",
            therapy_name: "Reiki",
            therapy_slug: "reiki",
          },
        ],
        ok: true,
      }),
    );

    const result = await getPublicTherapistSearchResult(filters);

    expect(result.therapists[0]?.description).toBe(
      "Acolhimento online com escuta cuidadosa.",
    );
    expect(result.therapists[0]?.description).not.toBe(
      "Descrição da oferta de Reiki.",
    );
  });

  it("uses all published therapies from the public services projection", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => [
            {
              average_rating: 4.8,
              city: "São Paulo",
              duration_minutes: 50,
              has_video: false,
              highlight: "Perfil Verificado",
              highlight_tone: "verified",
              next_slot_at: null,
              photo_url: null,
              public_name: "Brunna P",
              review_count: 0,
              review_quote: null,
              search_text: "Brunna P apresentação Tarô",
              service_description: "Descrição da oferta de Tarô.",
              service_id: "service-taro",
              service_price_cents: 12000,
              service_title: "Tarô online",
              slug: "brunna-paiva",
              state: "SP",
              tags: ["Autoconhecimento"],
              theme_names: ["Autoconhecimento"],
              theme_slugs: ["autoconhecimento"],
              therapist_headline: "Acolhimento online com escuta cuidadosa.",
              therapy_id: "therapy-taro",
              therapy_name: "Tarô",
              therapy_slug: "taro",
            },
          ],
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => [
            {
              sort_order: 1,
              therapist_slug: "brunna-paiva",
              therapy_id: "therapy-taro",
              therapy_name: "Tarô",
              therapy_slug: "taro",
            },
            {
              sort_order: 2,
              therapist_slug: "brunna-paiva",
              therapy_id: "therapy-reiki",
              therapy_name: "Reiki",
              therapy_slug: "reiki",
            },
            {
              sort_order: 3,
              therapist_slug: "brunna-paiva",
              therapy_id: "therapy-constelacao",
              therapy_name: "Constelação Familiar",
              therapy_slug: "constelacao-familiar",
            },
          ],
          ok: true,
        }),
    );

    const result = await getPublicTherapistSearchResult(filters);

    expect(result.therapists[0]?.therapies).toEqual([
      { id: "therapy-taro", label: "Tarô", slug: "taro" },
      { id: "therapy-reiki", label: "Reiki", slug: "reiki" },
      {
        id: "therapy-constelacao",
        label: "Constelação Familiar",
        slug: "constelacao-familiar",
      },
    ]);
    expect(result.options.therapies.map((option) => option.value)).toEqual([
      "constelacao-familiar",
      "reiki",
      "taro",
    ]);
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
