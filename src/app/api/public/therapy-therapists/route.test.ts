import { describe, expect, it, vi } from "vitest";

const { getRelatedTherapists } = vi.hoisted(() => ({
  getRelatedTherapists: vi.fn(),
}));

vi.mock("@/features/therapies/queries/get-related-therapists", () => ({
  getRelatedTherapists,
  parseRelatedTherapistSort: (value?: string) =>
    value === "rating" || value === "next_slot" ? value : "relevance",
}));

import { POST } from "./route";

const themeId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/public/therapy-therapists", () => {
  it("limits the Match related-professionals response to six cards", async () => {
    getRelatedTherapists.mockResolvedValueOnce({
      items: [],
    });

    const response = await POST(
      new Request("http://localhost/api/public/therapy-therapists", {
        body: JSON.stringify({
          interestIds: [],
          slug: "reiki",
          sort: "relevance",
          themeIds: [themeId],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(getRelatedTherapists).toHaveBeenCalledWith({
      interestIds: [],
      limit: 6,
      slug: "reiki",
      sort: "relevance",
      themeIds: [themeId],
    });
  });

  it("rejects a Match request without valid selected themes", async () => {
    const response = await POST(
      new Request("http://localhost/api/public/therapy-therapists", {
        body: JSON.stringify({ slug: "reiki", themeIds: [] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
