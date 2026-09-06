import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareAndUploadSupportAttachments } from "./support-direct-attachment-upload";

describe("direct support attachment uploads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads every selected file directly after the server authorizes the paths", async () => {
    const files = [
      new File(["first"], "primeiro.pdf", { type: "application/pdf" }),
      new File(["second"], "segundo.png", { type: "image/png" }),
    ];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/support/tickets/")) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            action: "prepare",
            attachments: [
              {
                mimeType: "application/pdf",
                originalName: "primeiro.pdf",
                sizeBytes: 5,
              },
              {
                mimeType: "image/png",
                originalName: "segundo.png",
                sizeBytes: 6,
              },
            ],
          });
          return Response.json({
            ok: true,
            uploads: [
              {
                mimeType: "application/pdf",
                originalName: "primeiro.pdf",
                signedUrl: "https://storage.test/one",
                sizeBytes: 5,
                storageObjectPath: "ticket/request/01-first-primeiro.pdf",
              },
              {
                mimeType: "image/png",
                originalName: "segundo.png",
                signedUrl: "https://storage.test/two",
                sizeBytes: 6,
                storageObjectPath: "ticket/request/02-second-segundo.png",
              },
            ],
          });
        }
        expect(init?.method).toBe("PUT");
        expect(init?.headers).toEqual({ "x-upsert": "false" });
        return new Response(null, { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const uploaded = await prepareAndUploadSupportAttachments({
      actorRole: "therapist",
      files,
      requestId: "20000000-0000-4000-8000-000000000001",
      ticketId: "30000000-0000-4000-8000-000000000001",
    });

    expect(uploaded).toEqual([
      expect.objectContaining({
        originalName: "primeiro.pdf",
        storageObjectPath: "ticket/request/01-first-primeiro.pdf",
      }),
      expect.objectContaining({
        originalName: "segundo.png",
        storageObjectPath: "ticket/request/02-second-segundo.png",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uploads selected attachments one at a time", async () => {
    const files = [
      new File(["first"], "primeiro.pdf", { type: "application/pdf" }),
      new File(["second"], "segundo.png", { type: "image/png" }),
    ];
    let beginFirstUpload!: () => void;
    const firstUploadStarted = new Promise<void>((resolve) => {
      beginFirstUpload = resolve;
    });
    let finishFirstUpload!: (response: Response) => void;
    const firstUpload = new Promise<Response>((resolve) => {
      finishFirstUpload = resolve;
    });
    let secondUploadStarted = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/support/tickets/")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            uploads: uploadPlans(),
          }),
        );
      }
      if (url.endsWith("/one")) {
        beginFirstUpload();
        return firstUpload;
      }
      if (url.endsWith("/two")) {
        secondUploadStarted = true;
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const pendingUpload = prepareAndUploadSupportAttachments({
      actorRole: "therapist",
      files,
      requestId: "20000000-0000-4000-8000-000000000001",
      ticketId: "30000000-0000-4000-8000-000000000001",
    });

    await firstUploadStarted;
    expect(secondUploadStarted).toBe(false);

    finishFirstUpload(new Response(null, { status: 200 }));
    await pendingUpload;

    expect(secondUploadStarted).toBe(true);
  });

  it("cleans only the already uploaded attachments after a partial failure", async () => {
    const files = [
      new File(["first"], "primeiro.pdf", { type: "application/pdf" }),
      new File(["second"], "segundo.png", { type: "image/png" }),
    ];
    let cleanupBody: unknown = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/support/tickets/")) {
        const body = JSON.parse(String(init?.body)) as { action?: string };
        if (body.action === "prepare") {
          return Promise.resolve(
            Response.json({ ok: true, uploads: uploadPlans() }),
          );
        }
        if (body.action === "cleanup") {
          cleanupBody = body;
          return Promise.resolve(Response.json({ ok: true }));
        }
      }
      if (url.endsWith("/one")) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      if (url.endsWith("/two")) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareAndUploadSupportAttachments({
        actorRole: "therapist",
        files,
        requestId: "20000000-0000-4000-8000-000000000001",
        ticketId: "30000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow("Não foi possível enviar todos os anexos agora.");

    expect(cleanupBody).toMatchObject({
      action: "cleanup",
      attachments: [
        expect.objectContaining({
          storageObjectPath: "ticket/request/01-first-primeiro.pdf",
        }),
      ],
    });
  });
});

function uploadPlans() {
  return [
    {
      mimeType: "application/pdf",
      originalName: "primeiro.pdf",
      signedUrl: "https://storage.test/one",
      sizeBytes: 5,
      storageObjectPath: "ticket/request/01-first-primeiro.pdf",
    },
    {
      mimeType: "image/png",
      originalName: "segundo.png",
      signedUrl: "https://storage.test/two",
      sizeBytes: 6,
      storageObjectPath: "ticket/request/02-second-segundo.png",
    },
  ];
}
