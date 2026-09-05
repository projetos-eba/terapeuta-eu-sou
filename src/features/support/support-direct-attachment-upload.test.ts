import { describe, expect, it, vi } from "vitest";

import { prepareAndUploadSupportAttachments } from "./support-direct-attachment-upload";

describe("direct support attachment uploads", () => {
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
    vi.unstubAllGlobals();
  });
});
