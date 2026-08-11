import { afterEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(() => ({
    apiKey: "public-test-key",
    url: "https://example.supabase.co",
  })),
}));

vi.mock("@/lib/supabase/public-config", () => configMocks);

import {
  getTherapistPlanPageData,
  TherapistPlanQueryError,
} from "./therapist-plan.queries";

describe("getTherapistPlanPageData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the catalog and a scheduled downgrade without changing the effective plan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(catalogRows()))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            cancel_at_period_end: false,
            current_period_end: "2026-09-11T03:00:00.000Z",
            metadata: {
              scheduled_plan_code: "premium",
              scheduled_plan_effective_at: "2026-09-11T03:00:00.000Z",
            },
            plan_code: "premium_plus",
            status: "active",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTherapistPlanPageData({
      accessToken: "access-token",
      effectivePlan: "premium_plus",
      profileId: "profile-id",
    });

    expect(result.effectivePlan).toBe("premium_plus");
    expect(result.subscription?.scheduledPlan).toBe("premium");
    expect(result.catalog.map((item) => item.unitAmountCents)).toEqual([
      0, 6000, 12000,
    ]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "status=in.%28active%2Ctrialing%2Cpast_due%2Cunpaid%2Cpaused%2Cincomplete%29",
    );
  });

  it("fails closed when a paid catalog price is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(catalogRows().slice(0, 2)))
        .mockResolvedValueOnce(jsonResponse([])),
    );

    await expect(
      getTherapistPlanPageData({
        accessToken: "access-token",
        effectivePlan: "free",
        profileId: "profile-id",
      }),
    ).rejects.toBeInstanceOf(TherapistPlanQueryError);
  });
});

function catalogRows() {
  return [
    { code: "free", description: "", name: "Free", prices: [] },
    {
      code: "premium",
      description: "",
      name: "Premium",
      prices: [
        {
          currency: "BRL",
          interval: "month",
          is_active: true,
          unit_amount_cents: 6000,
        },
      ],
    },
    {
      code: "premium_plus",
      description: "",
      name: "Premium Plus",
      prices: [
        {
          currency: "BRL",
          interval: "month",
          is_active: true,
          unit_amount_cents: 12000,
        },
      ],
    },
  ];
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
