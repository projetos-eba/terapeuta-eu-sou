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

  it("forwards a valid rating filter only for the requested reviews query", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        metrics: { "total-reviews": 1 },
        module: "reviews",
        page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
        rows: [
          {
            booking_id: "booking-1",
            id: "review-1",
            rating: 5,
            status: "published",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAdminOperationPage({
      accessToken: "admin-token",
      module: "reviews",
      searchParams: { rating: "5" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_operation_module_v2",
      expect.objectContaining({
        body: JSON.stringify({
          p_module: "reviews",
          p_query: { page: 1, pageSize: 12, rating: "5" },
        }),
      }),
    );
  });

  it("maps global patient metrics including comparison and suspension independently of page rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          metrics: {
            "total-patients": 100,
            "recent-patients": 20,
            "previous-patients": 10,
            "active-patients": 80,
            "suspended-patients": 5,
            "active-patients-percentage": 80,
          },
          page: { page: 2, pageSize: 12, total: 5, hasNext: false },
          rows: [],
        }),
      ),
    );
    const result = await getAdminOperationPage({
      accessToken: "admin-token",
      module: "patients",
      searchParams: { status: "suspended" },
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.metrics).toHaveLength(4);
      expect(result.data.metrics[1]).toMatchObject({
        value: 20,
        comparisonValue: 10,
      });
      expect(result.data.metrics[2]).toMatchObject({
        value: 80,
        percentage: 80,
      });
      expect(result.data.metrics[3]).toMatchObject({
        value: 5,
        status: "available",
      });
      expect(result.data.filterOptions.status).toContainEqual({
        label: "Suspensos",
        value: "suspended",
      });
      expect(result.data.patientAnalytics).toMatchObject({
        activityAge: [],
        periodDays: 30,
        series: [],
        status: "unavailable",
      });
    }
  });

  it("requests and maps the global client analytics for the selected period", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        metrics: {},
        page: { page: 1, pageSize: 12, total: 1, hasNext: false },
        patientAnalytics: {
          activityAge: [{ label: "Até 7 dias", value: 1 }],
          periodDays: 90,
          series: [
            {
              label: "01/09",
              newRegistrations: 2,
              totalClients: 100,
            },
          ],
          status: "available",
        },
        rows: [
          {
            account_status: "active",
            created_at: "2026-09-01T10:00:00.000Z",
            display_name: "Cliente Analytics",
            email: "cliente.analytics@example.test",
            id: "patient-analytics",
            phone: "11987654321",
            phone_country_code: "55",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminOperationPage({
      accessToken: "admin-token",
      module: "patients",
      searchParams: { analyticsPeriod: "90" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_operation_module_v2",
      expect.objectContaining({
        body: JSON.stringify({
          p_module: "patients",
          p_query: {
            page: 1,
            pageSize: 12,
            analyticsPeriod: 90,
          },
        }),
      }),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.patientAnalytics).toEqual({
        activityAge: [{ label: "Até 7 dias", value: 1 }],
        periodDays: 90,
        series: [
          { label: "01/09", newRegistrations: 2, totalClients: 100 },
        ],
        status: "available",
      });
      expect(result.data.rows[0]).toMatchObject({
        email: "cliente.analytics@example.test",
        fields: expect.arrayContaining([
          { label: "Contato", value: "+55 (11) 98765-4321" },
          { label: "Cadastro", value: "01/09/2026" },
        ]),
      });
    }
  });

  it("offers every canonical booking status through Portuguese admin filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          metrics: {},
          module: "sessions",
          page: { page: 1, pageSize: 12, total: 0, hasNext: false },
          rows: [],
        }),
      ),
    );

    const result = await getAdminOperationPage({
      accessToken: "admin-token",
      module: "sessions",
      searchParams: {},
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.filterOptions.status).toEqual(
        expect.arrayContaining([
          {
            label: "Canceladas por falha no pagamento",
            value: "cancelled_by_payment",
          },
          { label: "Cliente ausente", value: "no_show_patient" },
          { label: "Terapeuta ausente", value: "no_show_therapist" },
          { label: "Ambos ausentes", value: "no_show_both" },
        ]),
      );
    }
  });

  it("loads current-attempt private quality through the Admin V2 contract", async () => {
    const bookingId = "00000000-0000-4000-8000-000000000153";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/rpc/admin_get_operation_detail_v1")) {
        return jsonResponse({
          auditEvents: [],
          generatedAt: "2026-09-18T17:00:00.000Z",
          module: "sessions",
          record: { id: bookingId },
        });
      }
      if (url.endsWith("/rpc/admin_get_session_feedback_v2")) {
        return jsonResponse({
          attendance: { bothJoined: true, patientJoined: true, therapistJoined: true, sessionClosed: true },
          confirmation: { patient: null, therapist: null },
          financial: { serviceStatus: "scheduled", transferStatus: "transferred" },
          patient: { authorRole: "patient", successful: true, rating: 5, comment: "Bem atendido", createdAt: "2026-09-18T17:05:00.000Z" },
          therapist: { authorRole: "therapist", successful: true, rating: 5, comment: "Tudo certo", createdAt: "2026-09-18T17:06:00.000Z" },
          pendingRoles: [],
          qualityReview: { isOpen: false, overdue: false, allAnswered: false },
          legacyFeedback: [],
        });
      }
      return jsonResponse({ error: "unexpected rpc" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminOperationDetailPage({
      accessToken: "admin-token",
      id: bookingId,
      module: "sessions",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_get_session_feedback_v2",
      expect.objectContaining({
        body: JSON.stringify({ p_booking_id: bookingId }),
        method: "POST",
      }),
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.sessionFeedback).toMatchObject({
        status: "available",
        data: {
          patient: { successful: true, rating: 5 },
          therapist: { successful: true, rating: 5 },
          pendingRoles: [],
        },
      });
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

      if (
        url ===
        "https://tes.supabase.test/rest/v1/public_therapist_profile_content_v?slug=eq.ana-oliveira&select=short_intro,essence_body,invitation_body,experience_years,guide_items&limit=1"
      ) {
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/public_therapist_profile_content_v?slug=eq.ana-oliveira&select=short_intro,essence_body,invitation_body,experience_years,guide_items&limit=1",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
        }),
      }),
    );
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

  it.each([
    { slug: undefined, responseStatus: 200, expectedStatus: "unavailable" },
    { slug: "   ", responseStatus: 200, expectedStatus: "unavailable" },
    { slug: "ana-oliveira", responseStatus: 200, expectedStatus: "available" },
    {
      slug: "ana-oliveira",
      responseStatus: 400,
      expectedStatus: "unavailable",
    },
  ])(
    "keeps published content safe for slug=$slug and HTTP $responseStatus",
    async ({ slug, responseStatus, expectedStatus }) => {
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
              slug,
              status: "approved",
            },
          });
        }
        if (url.includes("public_therapist_profile_content_v")) {
          return jsonResponse([], { status: responseStatus });
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
      if (result.status === "success") {
        expect(result.data.publicProfile).toEqual({
          content: null,
          services: expectedStatus === "available" ? [] : null,
          status: expectedStatus,
        });
      }
      const publicCalls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes("public_therapist_profile_"));
      expect(publicCalls).toHaveLength(slug?.trim() ? 1 : 0);
      expect(publicCalls.join(" ")).not.toContain("therapist_profile_id");
      expect(
        fetchMock.mock.calls.map(([input]) => String(input)).join(" "),
      ).not.toContain("/rest/v1/therapist_profile_content_versions");
    },
  );
});

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
