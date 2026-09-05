import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({ getSupabasePublicConfig: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { POST } from "./route";

const ticketId = "30000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ ticketId }) };

describe("support ticket direct attachment authorization", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("authorizes a separate signed upload for every selected attachment", async () => {
    let signCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user"))
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      if (url.includes("/rest/v1/profiles"))
        return Response.json([{ role: "therapist" }]);
      if (url.includes("/rest/v1/support_tickets"))
        return Response.json([{ id: ticketId }]);
      if (
        url.includes(
          "/storage/v1/object/upload/sign/support-ticket-attachments/",
        )
      ) {
        signCount += 1;
        return Response.json({
          url: `/object/upload/sign/support-ticket-attachments/file-${signCount}?token=signed-${signCount}`,
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        action: "prepare",
        attachments: [
          {
            mimeType: "application/pdf",
            originalName: "primeiro.pdf",
            sizeBytes: 3,
          },
          { mimeType: "image/png", originalName: "segundo.png", sizeBytes: 3 },
        ],
      }),
      context,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.uploads).toHaveLength(2);
    expect(payload.uploads[0].signedUrl).toBe(
      "https://tes.supabase.test/storage/v1/object/upload/sign/support-ticket-attachments/file-1?token=signed-1",
    );
    expect(signCount).toBe(2);
  });

  it("only finalizes the prepared paths for the request that owns the ticket", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user"))
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        if (url.includes("/rest/v1/profiles"))
          return Response.json([{ role: "therapist" }]);
        if (url.includes("/rest/v1/support_tickets"))
          return Response.json([{ id: ticketId }]);
        if (
          url.includes("/rpc/attach_support_ticket_requester_attachments_v1")
        ) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            p_attachments: [
              expect.objectContaining({
                storageObjectPath: `${ticketId}/${requestId}/01-primeiro.pdf`,
              }),
              expect.objectContaining({
                storageObjectPath: `${ticketId}/${requestId}/02-segundo.png`,
              }),
            ],
            p_request_id: requestId,
            p_ticket_id: ticketId,
          });
          return Response.json(null);
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        action: "complete",
        attachments: [
          {
            mimeType: "application/pdf",
            originalName: "primeiro.pdf",
            sizeBytes: 3,
            storageObjectPath: `${ticketId}/${requestId}/01-primeiro.pdf`,
          },
          {
            mimeType: "image/png",
            originalName: "segundo.png",
            sizeBytes: 3,
            storageObjectPath: `${ticketId}/${requestId}/02-segundo.png`,
          },
        ],
      }),
      context,
    );

    expect(response.status).toBe(200);
  });
});

function request(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    body: JSON.stringify({
      actorRole: "therapist",
      requestId,
      ...body,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
