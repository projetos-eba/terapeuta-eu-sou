import { describe, expect, it, vi } from "vitest";

import { parseContentRangeTotal } from "./admin-dashboard.utils";

describe("admin dashboard queries", () => {
  it("parses exact PostgREST content-range totals", () => {
    expect(parseContentRangeTotal("0-0/42")).toBe(42);
    expect(parseContentRangeTotal("*/0")).toBe(0);
  });

  it("treats absent or unknown totals as unavailable", () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("0-0/*")).toBeNull();
    expect(parseContentRangeTotal("invalid")).toBeNull();
  });

  it("loads dashboard aggregates from the admin dashboard RPC", async () => {
    vi.resetModules();
    vi.doMock("react", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/public-config", () => ({
      getSupabasePublicConfig: () => ({
        apiKey: "publishable-key",
        url: "https://tes.supabase.test",
      }),
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/rest/v1/rpc/admin_get_dashboard_v1")) {
        return jsonResponse({
          events: [
            {
              actorRole: "admin",
              createdAt: "2026-08-09T07:00:00.000Z",
              entityType: "therapy",
              eventType: "therapy_published",
              id: "audit-1",
              reason: "Catálogo revisado.",
            },
          ],
          generatedAt: "2026-08-09T07:00:00.000Z",
          metrics: {
            "active-patients": 9,
            "active-subscriptions": 3,
            "active-therapists": 4,
            "attention-sessions": 1,
            "attention-subscriptions": 0,
            "draft-therapies": 2,
            "failed-emails": 0,
            "failed-video-sessions": 0,
            "failed-webhooks": 0,
            "failed-zoom-webhooks": 0,
            "future-sessions": 6,
            "matching-visible-therapies": 5,
            "open-disputes": 0,
            "open-payout-batches": 1,
            "open-support-tickets": 2,
            "paid-session-payments": 7,
            "pending-refunds": 0,
            "pending-session-payments": 1,
            "pending-therapists": 2,
            "pending-therapy-requests": 1,
            "published-therapies": 5,
            "restricted-connect-accounts": 1,
          },
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAdminDashboardPage } = await import(
      "./admin-dashboard.queries"
    );
    const result = await getAdminDashboardPage({ accessToken: "admin-token" });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.dashboard.generatedAt).toBe("2026-08-09T07:00:00.000Z");
    expect(result.dashboard.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "published-therapies",
          status: "available",
          value: 5,
        }),
      ]),
    );
    expect(result.dashboard.events).toEqual([
      expect.objectContaining({ eventType: "therapy_published" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/rest/v1/rpc/admin_get_dashboard_v1",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(
      "/rest/v1/therapy_catalog_events",
    );
  });

  it("keeps dashboard metrics unavailable when the RPC fails", async () => {
    vi.resetModules();
    vi.doMock("react", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    }));
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/public-config", () => ({
      getSupabasePublicConfig: () => ({
        apiKey: "publishable-key",
        url: "https://tes.supabase.test",
      }),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 403 })),
    );

    const { getAdminDashboardPage } = await import(
      "./admin-dashboard.queries"
    );
    const result = await getAdminDashboardPage({ accessToken: "admin-token" });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(
      result.dashboard.modules
        .flatMap((module) => module.metrics)
        .every((metric) => metric.status === "unavailable"),
    ).toBe(false);
    expect(
      result.dashboard.modules
        .find((module) => module.key === "catalog")
        ?.metrics.every((metric) => metric.status === "unavailable"),
    ).toBe(true);
  });
});

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
