import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { getAdminOperationPage } from "./admin-operations.queries";

describe("admin operation queries", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    configMocks.getSupabasePublicConfig.mockReset();
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("loads operation modules through the paginated v2 RPC", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        generatedAt: "2026-08-09T14:00:00.000Z",
        metrics: { "total-professionals": 1 },
        module: "professionals",
        page: { hasNext: false, page: 2, pageSize: 10, total: 1 },
        rows: [
          {
            id: "profile-1",
            public_name: "Ana Oliveira",
            status: "approved",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminOperationPage({
      accessToken: "admin-token",
      module: "professionals",
      searchParams: {
        page: "2",
        pageSize: "10",
        q: "Ana",
        sort: "status",
        status: "approved",
      },
    });

    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_operation_module_v2",
      expect.objectContaining({
        body: JSON.stringify({
          p_module: "professionals",
          p_query: {
            page: 2,
            pageSize: 10,
            search: "Ana",
            sort: "status",
            status: "approved",
          },
        }),
        method: "POST",
      }),
    );
    if (result.status === "success") {
      expect(result.data.page).toEqual({
        hasNext: false,
        page: 2,
        pageSize: 10,
        total: 1,
      });
      expect(JSON.stringify(result.data)).not.toContain("secret");
    }
  });
});

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
