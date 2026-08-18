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

import {
  deriveProfileDecisionVerificationSummary,
  getAdminOperationDetailPage,
  getAdminOperationPage,
} from "./admin-operations.queries";

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

  it("uses an approved profile decision only as a read-only verification fallback", () => {
    expect(deriveProfileDecisionVerificationSummary("approved")).toEqual({
      reviewedAt: null,
      source: "profile_status",
      status: "approved",
      submittedAt: null,
    });
    expect(deriveProfileDecisionVerificationSummary("submitted")).toBeNull();
  });

  it("loads only the safe published profile projection for a professional detail", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("admin_get_operation_detail_v1")) {
        return jsonResponse({
          auditEvents: [],
          generatedAt: "2026-08-14T12:00:00.000Z",
          module: "professionals",
          record: {
            id: "00000000-0000-4000-8000-000000000001",
            public_name: "Ana Oliveira",
            slug: "ana-oliveira",
            status: "approved",
          },
        });
      }

      if (url.includes("public_therapist_profile_content_v")) {
        return jsonResponse([
          {
            essence_body: "Escuta responsável.",
            experience_years: 8,
            guide_items: [{ label: "Escuta atenta", private_note: "ignore" }],
            invitation_body: "Conheça esta abordagem.",
            short_intro: "Presença para o seu momento.",
          },
        ]);
      }

      if (url.includes("public_therapist_profile_services_v")) {
        return jsonResponse([
          {
            description: "Atendimento online.",
            duration_minutes: 60,
            price_cents: 18000,
            service_title: "Encontro de Reiki",
            therapy_name: "Reiki",
          },
        ]);
      }

      if (url.includes("therapist_verifications")) return jsonResponse([]);
      return jsonResponse({ ok: false }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminOperationDetailPage({
      accessToken: "admin-token",
      id: "00000000-0000-4000-8000-000000000001",
      module: "professionals",
    });

    expect(result.status).toBe("success");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes(
          "/rest/v1/public_therapist_profile_content_v?therapist_profile_id=eq.00000000-0000-4000-8000-000000000001",
        ),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes(
          "/rest/v1/public_therapist_profile_services_v?therapist_slug=eq.ana-oliveira",
        ),
      ),
    ).toBe(true);
    if (result.status === "success") {
      expect(result.data.publicProfile).toEqual({
        content: {
          essenceBody: "Escuta responsável.",
          experienceYears: 8,
          guideItems: [{ label: "Escuta atenta" }],
          invitationBody: "Conheça esta abordagem.",
          shortIntro: "Presença para o seu momento.",
        },
        services: [
          {
            description: "Atendimento online.",
            durationMinutes: 60,
            priceCents: 18000,
            serviceTitle: "Encontro de Reiki",
            therapyName: "Reiki",
          },
        ],
        status: "available",
      });
      expect(JSON.stringify(result.data.publicProfile)).not.toContain(
        "private_note",
      );
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
