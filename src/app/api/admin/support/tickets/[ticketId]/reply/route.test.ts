import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({ getSupabasePublicConfig: vi.fn() }));
const sessionMocks = vi.hoisted(() => ({
  readAdminSessionFromAccessToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));
vi.mock("@/lib/auth/admin-session", () => ({
  readAdminSessionFromAccessToken: sessionMocks.readAdminSessionFromAccessToken,
}));

import { POST } from "./route";

const ticketId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ ticketId }) };

describe("admin support reply route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.support.manage"],
    });
  });

  it("checks the protected idempotency contract before uploading an attachment", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/rpc/admin_support_ticket_message_exists_v1")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            p_request_id: requestId,
            p_ticket_id: ticketId,
          });
          return Response.json(false);
        }
        if (url.includes("/storage/v1/object/support-ticket-attachments/")) {
          return new Response(null, { status: 201 });
        }
        if (
          url.includes("/rpc/admin_reply_support_ticket_with_attachments_v1")
        ) {
          const payload = JSON.parse(String(init?.body));
          expect(payload).toMatchObject({
            p_body: "Segue o documento solicitado.",
            p_request_id: requestId,
            p_ticket_id: ticketId,
          });
          expect(payload.p_attachments).toHaveLength(1);
          expect(payload.p_attachments[0]).toMatchObject({
            mimeType: "application/pdf",
            originalName: "orientacao.pdf",
            sizeBytes: 3,
          });
          return Response.json({ id: "33333333-3333-4333-8333-333333333333" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(multipartRequest(), params);

    expect(response.status, JSON.stringify(await response.json())).toBe(201);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/rest/v1/support_ticket_messages"),
      ),
    ).toBe(false);
  });

  it("does not upload again when the protected idempotency contract finds the reply", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (
        String(input).includes("/rpc/admin_support_ticket_message_exists_v1")
      ) {
        return Response.json(true);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(multipartRequest(), params);

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads a supported PNG attachment through the same protected reply flow", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/rpc/admin_support_ticket_message_exists_v1")) {
          return Response.json(false);
        }
        if (url.includes("/storage/v1/object/support-ticket-attachments/")) {
          expect(init?.headers).toMatchObject({ "Content-Type": "image/png" });
          return new Response(null, { status: 201 });
        }
        if (
          url.includes("/rpc/admin_reply_support_ticket_with_attachments_v1")
        ) {
          const payload = JSON.parse(String(init?.body));
          expect(payload.p_attachments).toEqual([
            expect.objectContaining({
              mimeType: "image/png",
              originalName: "evidencia.png",
              sizeBytes: 3,
            }),
          ]);
          return Response.json({ id: "33333333-3333-4333-8333-333333333333" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      multipartRequest({ name: "evidencia.png", type: "image/png" }),
      params,
    );

    expect(response.status, JSON.stringify(await response.json())).toBe(201);
  });
});

function multipartRequest({
  name = "orientacao.pdf",
  type = "application/pdf",
}: {
  name?: string;
  type?: string;
} = {}) {
  const formData = new FormData();
  formData.set("body", "Segue o documento solicitado.");
  formData.set("requestId", requestId);
  formData.append(
    "attachments",
    new File(["bin"], name, { type }),
  );

  return {
    formData: async () => formData,
    headers: new Headers({ "Content-Type": "multipart/form-data" }),
  } as unknown as Request;
}
