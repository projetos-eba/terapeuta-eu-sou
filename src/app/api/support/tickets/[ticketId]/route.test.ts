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

import { GET, POST } from "./route";

const ticketId = "30000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ ticketId }) };

describe("support ticket detail route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("serializes only requester-visible messages from the authenticated therapist ticket", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rest/v1/support_tickets")) {
        return Response.json([
          {
            booking_id: null,
            category: "financeiro_repasses",
            created_at: "2026-08-21T12:00:00Z",
            description: "Mensagem inicial.",
            id: ticketId,
            last_activity_at: "2026-08-21T12:00:00Z",
            protocol: "582914730F",
            resolved_at: null,
            status: "open",
            subject: "Dúvida sobre repasse",
          },
        ]);
      }
      if (url.includes("/rest/v1/support_ticket_messages")) {
        expect(url).toContain("visibility=eq.requester");
        return Response.json([
          {
            author_role: "admin",
            body: "A equipe TES está acompanhando.",
            created_at: "2026-08-21T12:05:00Z",
            id: "40000000-0000-4000-8000-000000000001",
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost?role=therapist"),
      context,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ticket.messages).toEqual([
      expect.objectContaining({ body: "A equipe TES está acompanhando." }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("internal");
  });

  it("rejects an empty requester reply before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ body: "   ", requestId }), context);

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps the server reply rate limit to a retryable 429", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
        return Response.json({ code: "P0001" }, { status: 400 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ body: "Resposta para o suporte.", requestId }),
      context,
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { message: "Aguarde um momento antes de enviar outra resposta." },
    });
  });

  it("keeps an actionable error if a stale backend rejects a consecutive reply", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
        return Response.json(
          { code: "22023", message: "support ticket is already awaiting TES" },
          { status: 400 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ body: "Complemento repetido.", requestId }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        message:
          "Não foi possível enviar este complemento agora. Tente novamente.",
      },
    });
  });

  it("explains attachment validation failures without exposing storage details", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
        return Response.json(
          {
            code: "22023",
            message: "support attachment metadata is invalid",
          },
          { status: 400 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ body: "Complemento com anexo.", requestId }),
      context,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        message:
          "Não foi possível enviar o anexo. Use até 5 arquivos de até 10 MB cada, nos formatos PDF, JPG, PNG ou WebP.",
      },
    });
  });

  it("renders a legacy description as the initial public message", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rest/v1/support_tickets")) {
        return Response.json([
          {
            booking_id: null,
            category: "atendimento",
            created_at: "2026-08-21T12:00:00Z",
            description: "Descrição histórica sem thread persistida.",
            id: ticketId,
            last_activity_at: "2026-08-21T12:00:00Z",
            protocol: "582914730O",
            resolved_at: null,
            status: "open",
            subject: "Chamado histórico",
          },
        ]);
      }
      if (url.includes("/rest/v1/support_ticket_messages")) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost?role=therapist"),
      context,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ticket.messages).toEqual([
      {
        author_role: "requester",
        body: "Descrição histórica sem thread persistida.",
        created_at: "2026-08-21T12:00:00Z",
        id: `legacy-initial:${ticketId}`,
      },
    ]);
  });

  it("posts a public reply through the requester RPC without browser identity", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "therapist" }]);
        }
        if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            p_body: "Complemento público.",
            p_request_id: requestId,
            p_ticket_id: ticketId,
          });
          return Response.json({ id: "40000000-0000-4000-8000-000000000002" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ body: "Complemento público.", requestId }),
      context,
    );

    expect(response.status).toBe(201);
  });

  it("uploads an allowed attachment and sends its server-side descriptor", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "therapist" }]);
        }
        if (url.includes("/rest/v1/support_ticket_messages")) {
          return Response.json([]);
        }
        if (url.includes("/storage/v1/object/support-ticket-attachments/")) {
          return new Response(null, { status: 201 });
        }
        if (
          url.includes(
            "/rpc/send_support_ticket_requester_message_with_attachments_v1",
          )
        ) {
          const payload = JSON.parse(String(init?.body));
          expect(payload.p_body).toBe("Complemento com comprovante.");
          expect(payload.p_ticket_id).toBe(ticketId);
          expect(payload.p_attachments).toHaveLength(1);
          expect(payload.p_attachments[0]).toMatchObject({
            mimeType: "application/pdf",
            originalName: "comprovante.pdf",
            sizeBytes: 3,
          });
          return Response.json({ id: "40000000-0000-4000-8000-000000000004" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(multipartRequest(), context);

    expect(response.status, JSON.stringify(await response.json())).toBe(201);
  });

  it("persists every descriptor from a multi-file direct upload in one reply", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "therapist" }]);
        }
        if (
          url.includes(
            "/rpc/send_support_ticket_requester_message_with_attachments_v1",
          )
        ) {
          const payload = JSON.parse(String(init?.body));
          expect(payload.p_attachments).toEqual([
            expect.objectContaining({
              originalName: "primeiro.pdf",
              storageObjectPath: `${ticketId}/${requestId}/01-primeiro.pdf`,
            }),
            expect.objectContaining({
              originalName: "segundo.png",
              storageObjectPath: `${ticketId}/${requestId}/02-segundo.png`,
            }),
          ]);
          return Response.json({ id: "40000000-0000-4000-8000-000000000005" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(directAttachmentRequest(), context);

    expect(response.status, JSON.stringify(await response.json())).toBe(201);
  });

  it("loads and replies to a patient-owned support thread", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token"
        ? { value: "patient-token" }
        : undefined,
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "patient" }]);
        }
        if (url.includes("/rest/v1/support_tickets")) {
          return Response.json([
            {
              booking_id: null,
              category: "zoom_acesso",
              created_at: "2026-08-21T12:00:00Z",
              description: "Não consigo entrar.",
              id: ticketId,
              last_activity_at: "2026-08-21T12:00:00Z",
              protocol: "582914730Z",
              resolved_at: null,
              status: "open",
              subject: "Acesso à sessão",
            },
          ]);
        }
        if (url.includes("/rest/v1/support_ticket_messages")) {
          return Response.json([]);
        }
        if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            p_ticket_id: ticketId,
          });
          return Response.json({ id: "40000000-0000-4000-8000-000000000003" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const getResponse = await GET(
      new Request("http://localhost?role=patient"),
      context,
    );
    expect(getResponse.status).toBe(200);
    const postResponse = await POST(
      request({
        actorRole: "patient",
        body: "Ainda não consigo entrar.",
        requestId,
      }),
      context,
    );
    expect(postResponse.status).toBe(201);
  });
});

function request(body: unknown) {
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? { actorRole: "therapist", ...(body as Record<string, unknown>) }
      : body;
  return new Request("http://localhost", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function multipartRequest() {
  const formData = new FormData();
  formData.set("actorRole", "therapist");
  formData.set("body", "Complemento com comprovante.");
  formData.set("requestId", requestId);
  formData.append(
    "attachments",
    new File(["pdf"], "comprovante.pdf", { type: "application/pdf" }),
  );

  return {
    formData: async () => formData,
    headers: new Headers({ "Content-Type": "multipart/form-data" }),
  } as unknown as Request;
}

function directAttachmentRequest() {
  return request({
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
    body: "Complemento com dois anexos.",
    requestId,
  });
}
