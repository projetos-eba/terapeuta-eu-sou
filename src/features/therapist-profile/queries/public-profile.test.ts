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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not cache mutable identity, content, availability, or booking conflicts", async () => {
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
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(profileCall?.[1]).not.toHaveProperty("next");
  });

  it("uses the authoritative timezone-aware slots for every public service", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T19:33:00.000Z"));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("public_therapist_profiles_v")) {
        return jsonResponse([
          {
            accepts_online_sessions: true,
            average_rating: null,
            badges: [],
            bio: null,
            city: "São Paulo",
            id: "profile-1",
            is_accepting_bookings: true,
            is_verified: true,
            photo_url: null,
            plan: "premium_plus",
            public_name: "Terapeuta HML",
            published_headline: null,
            review_count: 0,
            sessions_completed: 0,
            short_intro: "Escuta responsável.",
            slug: "terapeuta-hml",
            state: "SP",
            tags: ["Reiki"],
            video_provider: null,
            video_thumbnail_url: null,
            video_title: null,
            video_url: null,
          },
        ]);
      }
      if (url.includes("public_therapist_profile_services_v")) {
        return jsonResponse([serviceRow]);
      }
      if (url.includes("public_therapy_details_v")) {
        return jsonResponse([
          {
            hero_image_url: "https://cdn.example.test/reiki-admin.jpg",
            id: "22222222-2222-4222-8222-222222222225",
            image_url: "https://cdn.example.test/reiki-default.jpg",
          },
        ]);
      }
      if (url.includes("get_service_available_slots_v1")) {
        return jsonResponse({
          slots: [
            {
              endsAt: "2026-08-11T20:35:00.000Z",
              startsAt: "2026-08-11T19:45:00.000Z",
            },
          ],
          timezone: "America/Sao_Paulo",
        });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicTherapistProfileResult("terapeuta-hml");

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.profile.services[0]?.imageUrl).toBe(
      "https://cdn.example.test/reiki-admin.jpg",
    );
    expect(result.data.profile.services[0]?.availability[0]).toMatchObject({
      date: "2026-08-11",
      dayLabel: "Hoje",
      slots: [expect.objectContaining({ timeLabel: "16:45" })],
    });
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("get_service_available_slots_v1"),
      ),
    ).toBe(true);
  });
});

const serviceRow = {
  availability_exceptions: [],
  availability_rules: [],
  booking_conflicts: [],
  buffer_after_minutes: 0,
  buffer_before_minutes: 0,
  currency: "BRL",
  description: "Sessão online com cuidado.",
  duration_minutes: 50,
  interval_minutes: 15,
  max_days_ahead: 30,
  min_notice_minutes: 0,
  price_cents: 12000,
  service_id: "e2e10000-0000-4000-8000-000000000001",
  service_title: "Reiki online",
  therapist_slug: "terapeuta-hml",
  therapy_id: "22222222-2222-4222-8222-222222222225",
  therapy_name: "Reiki",
  therapy_slug: "reiki",
};

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
