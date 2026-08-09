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
});
