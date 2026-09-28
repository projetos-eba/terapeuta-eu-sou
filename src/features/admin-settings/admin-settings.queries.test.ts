import { describe, expect, it, vi } from "vitest";

describe("admin settings queries", () => {
  it("marks release navigation healthy when no admin modules remain hidden", async () => {
    vi.resetModules();
    vi.doMock("react", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    }));

    const { buildReleaseChecks } = await import("./admin-settings.queries");
    const checks = buildReleaseChecks({
      enabledModules: 15,
      hasSupabasePublicConfig: true,
      hiddenModules: 0,
    });

    expect(checks).toContainEqual(
      expect.objectContaining({
        key: "navigation-complete",
        status: "healthy",
      }),
    );
  });

  it("does not expose environment values while building settings data", async () => {
    vi.resetModules();
    vi.doMock("react", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("TES_ENABLE_DEMO_DATA", "super-secret-value");

    const { getAdminSettingsPage } = await import("./admin-settings.queries");
    const result = await getAdminSettingsPage();

    expect(result.status).toBe("success");
    expect(JSON.stringify(result)).not.toContain("publishable-key");
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });

  it("reads only aggregate telemetry health through the authenticated admin contract", async () => {
    vi.resetModules();
    vi.doMock("react", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          contractVersion: 1,
          counters: {
            acceptedEvents: 12,
            duplicateEvents: 3,
            failedRequests: 0,
            invalidRequests: 1,
            rateLimitedRequests: 2,
          },
          lastActivityAt: "2026-09-27T14:00:00.000Z",
          lastCheckedAt: "2026-09-27T15:00:00.000Z",
          retentionDays: 120,
          state: "ready",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAdminSettingsPage } = await import("./admin-settings.queries");
    const result = await getAdminSettingsPage("admin-access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/admin_get_therapist_metrics_telemetry_health_v1",
      expect.objectContaining({
        body: "{}",
        headers: expect.objectContaining({
          Authorization: "Bearer admin-access-token",
        }),
        method: "POST",
      }),
    );
    expect(result).toMatchObject({ status: "success" });
    if (result.status !== "success") throw new Error("Expected settings data.");

    const telemetry = result.data.groups
      .flatMap((group) => group.items)
      .find((item) => item.key === "public-metrics-telemetry");
    expect(telemetry?.metrics).toEqual(
      expect.arrayContaining([
        { label: "Recebidos", value: 12 },
        { label: "Repetições evitadas", value: 3 },
        { label: "Falhas", value: 0 },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("admin-access-token");
  });
});
