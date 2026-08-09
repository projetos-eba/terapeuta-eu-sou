import { afterEach, describe, expect, it, vi } from "vitest";

describe("therapist reviews queries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends review reply mutations through the Edge Function boundary", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/public-config", () => ({
      getSupabasePublicConfig: () => ({
        apiKey: "publishable-key",
        url: "https://tes.supabase.test",
      }),
    }));

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          idempotentReplay: false,
          page: {
            distribution: [],
            generatedAt: "2026-08-09T00:00:00.000Z",
            metrics: {
              averageRating: null,
              distinctPatients: 0,
              pendingReplies: 0,
              positivePercent: null,
              positiveReviews: 0,
              respondedReviews: 0,
              totalReviews: 0,
              trends: {},
            },
            reviews: [],
            therapist: {
              plan: "premium",
              profileId: "therapist-profile-id",
              publicName: "Terapeuta TES",
              publicSlug: "terapeuta-tes",
            },
          },
        },
        ok: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { mutateTherapistReviewReply } = await import(
      "./therapist-reviews.queries"
    );
    const result = await mutateTherapistReviewReply({
      accessToken: "therapist-token",
      body: "Obrigada pelo retorno cuidadoso.",
      requestId: "a6000000-0000-4000-8000-000000000001",
      reviewId: "b6000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual(
      expect.objectContaining({ idempotentReplay: false }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/therapist-reviews-command",
      expect.objectContaining({
        body: JSON.stringify({
          action: "reply",
          body: "Obrigada pelo retorno cuidadoso.",
          requestId: "a6000000-0000-4000-8000-000000000001",
          reviewId: "b6000000-0000-4000-8000-000000000001",
        }),
        headers: {
          Authorization: "Bearer therapist-token",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const firstCallUrl = String(fetchMock.mock.calls.at(0)?.at(0) ?? "");

    expect(firstCallUrl).not.toContain(
      "/rest/v1/rpc/upsert_therapist_review_reply_v1",
    );
  });
});

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
