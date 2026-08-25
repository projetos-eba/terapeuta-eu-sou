import { describe, expect, it, vi } from "vitest";

import {
  readSupportAttachmentFiles,
  uploadSupportAttachments,
} from "./support-attachments";

describe("support attachments", () => {
  it("accepts the supported private attachment formats", () => {
    const formData = new FormData();
    formData.append(
      "attachments",
      new File(["image"], "evidencia.png", { type: "image/png" }),
    );

    const result = readSupportAttachmentFiles(formData);

    expect(result.error).toBeNull();
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe("evidencia.png");
  });

  it("rejects unsupported formats", () => {
    const formData = new FormData();
    formData.append(
      "attachments",
      new File(["script"], "arquivo.exe", {
        type: "application/octet-stream",
      }),
    );

    expect(readSupportAttachmentFiles(formData).error).toContain(
      "Formato não permitido",
    );
  });

  it("uploads with a ticket-scoped path and returns no storage path to callers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["pdf"], "comprovante.pdf", {
      type: "application/pdf",
    });

    const result = await uploadSupportAttachments({
      accessToken: "token",
      config: { apiKey: "key", url: "https://example.supabase.co" },
      files: [{ file, name: "comprovante.pdf" }],
      requestId: "10000000-0000-4000-8000-000000000001",
      ticketId: "20000000-0000-4000-8000-000000000001",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.descriptors[0]).toEqual(
      expect.objectContaining({
        mimeType: "application/pdf",
        originalName: "comprovante.pdf",
        sizeBytes: 3,
      }),
    );
    expect(result.descriptors[0]?.storageObjectPath).toContain(
      "20000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/",
    );
    vi.unstubAllGlobals();
  });
});
