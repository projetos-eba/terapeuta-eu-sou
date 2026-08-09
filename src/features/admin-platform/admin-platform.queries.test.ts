import { describe, expect, it, vi } from "vitest";

describe("admin platform queries", () => {
  it("loads integration health from the dedicated admin RPC", async () => {
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

      if (url.endsWith("/rest/v1/rpc/admin_get_integration_health_v1")) {
        return jsonResponse({
          generatedAt: "2026-08-09T07:10:00.000Z",
          last: {
            connectSyncAt: "2026-08-09T06:40:00.000Z",
            emailDeliveryAt: "2026-08-09T06:30:00.000Z",
            stripeWebhookAt: "2026-08-09T06:00:00.000Z",
            zoomWebhookAt: "2026-08-09T06:20:00.000Z",
          },
          signals: {
            "attention-subscriptions": 1,
            "failed-emails": 0,
            "failed-stripe-webhooks": 0,
            "failed-video-sessions": 0,
            "failed-zoom-webhooks": 0,
            "pending-session-payments": 2,
            "restricted-connect-accounts": 1,
          },
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAdminIntegrationsPage } = await import(
      "./admin-platform.queries"
    );
    const result = await getAdminIntegrationsPage({
      accessToken: "admin-token",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.data.generatedAt).toBe("2026-08-09T07:10:00.000Z");
    expect(result.data.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "pending-session-payments",
          status: "available",
          value: 2,
        }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/rest/v1/rpc/admin_get_integration_health_v1",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(
      "stripe_webhook_events",
    );
  });

  it("marks integration health as unavailable when the RPC fails", async () => {
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

    const { getAdminIntegrationsPage } = await import(
      "./admin-platform.queries"
    );
    const result = await getAdminIntegrationsPage({
      accessToken: "admin-token",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(
      result.data.summary.every((signal) => signal.status === "unavailable"),
    ).toBe(true);
    expect(
      result.data.integrations.every(
        (integration) => integration.status === "unavailable",
      ),
    ).toBe(true);
  });

  it("loads recent security events from centralized admin audit without states", async () => {
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

      if (url.includes("/rest/v1/admin_audit_events")) {
        return jsonResponse([
          {
            action: "matching_theme_created",
            actor_role: "admin",
            created_at: "2026-08-08T12:00:00.000Z",
            entity_type: "matching_theme",
            id: "audit-1",
            permission: "admin.matching.manage",
            reason: "Validacao.",
            source: "therapy_catalog_events",
          },
        ]);
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAdminSecurityPage } = await import("./admin-platform.queries");
    const result = await getAdminSecurityPage({ accessToken: "admin-token" });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.data.auditEvents).toEqual([
      expect.objectContaining({
        eventType: "matching_theme_created",
        permission: "admin.matching.manage",
        source: "therapy_catalog_events",
      }),
    ]);
    expect(result.data.auditEventsStatus).toBe("available");

    const auditCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/admin_audit_events"),
    );
    expect(String(auditCall?.[0])).toContain(
      "select=id,actor_role,permission,action,entity_type,reason,source,created_at",
    );
    expect(String(auditCall?.[0])).not.toContain("previous_state");
    expect(String(auditCall?.[0])).not.toContain("next_state");
  });

  it("marks centralized audit as unavailable when the read fails", async () => {
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

    const { getAdminSecurityPage } = await import("./admin-platform.queries");
    const result = await getAdminSecurityPage({ accessToken: "admin-token" });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.data.auditEvents).toEqual([]);
    expect(result.data.auditEventsStatus).toBe("unavailable");
  });
});

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
