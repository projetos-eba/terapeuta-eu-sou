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

import { getAdminFinancePage } from "./admin-finance.queries";

describe("admin finance queries", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    configMocks.getSupabasePublicConfig.mockReset();
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("loads payments through the paginated v2 RPC", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        generatedAt: "2026-08-09T14:00:00.000Z",
        metrics: { "paid-session-payments": 1 },
        module: "payments",
        page: { hasNext: true, page: 1, pageSize: 12, total: 13 },
        rows: [
          {
            financial_status: "paid",
            gross_amount_cents: 12000,
            id: "payment-1",
            stripe_payment_intent_id: "pi_secret",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminFinancePage({
      accessToken: "admin-token",
      module: "payments",
      searchParams: { q: "paid", status: "paid" },
    });

    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_finance_module_v2",
      expect.objectContaining({
        body: JSON.stringify({
          p_module: "payments",
          p_query: {
            page: 1,
            pageSize: 12,
            search: "paid",
            sort: undefined,
            status: "paid",
          },
        }),
        method: "POST",
      }),
    );
    if (result.status === "success") {
      expect(result.data.page.hasNext).toBe(true);
      expect(JSON.stringify(result.data)).not.toContain("pi_secret");
    }
  });

  it("loads reports through the same v2 RPC instead of REST table reads", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        metrics: { "report-payments": 1 },
        module: "reports",
        page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
        rows: [
          {
            export_status: "Pendente de comando auditado",
            id: "payments",
            status: "planned",
            title: "Relatório financeiro",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAdminFinancePage({
      accessToken: "admin-token",
      module: "reports",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_finance_module_v2",
      expect.any(Object),
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
