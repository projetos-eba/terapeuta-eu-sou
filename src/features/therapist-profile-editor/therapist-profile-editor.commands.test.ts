import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSaveMediaDraftCommand,
  uploadTherapistPrivateDocument,
  uploadTherapistProfileMedia,
} from "./therapist-profile-editor.commands";

describe("therapist profile media commands", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an idempotent photo draft command without profile fields", () => {
    const command = createSaveMediaDraftCommand({
      expectedVersion: 7,
      mediaUrl:
        "https://example.supabase.co/storage/v1/object/public/therapist-public-media/user/profile/photo.webp",
    });

    expect(command).toMatchObject({
      action: "save_media_draft",
      expectedVersion: 7,
      kind: "photo",
      mediaUrl: expect.stringContaining("therapist-public-media"),
    });
    expect(command.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("maps a successful public media upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              contentType: "image/webp",
              kind: "photo",
              publicUrl:
                "https://example.supabase.co/storage/v1/object/public/therapist-public-media/user/profile/photo.webp",
              size: 1200,
            },
            ok: true,
          }),
          { status: 200 },
        ),
      ),
    );

    const file = new File(["image"], "photo.webp", { type: "image/webp" });
    const result = await uploadTherapistProfileMedia({ file, kind: "photo" });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.kind).toBe("photo");
      expect(result.data.publicUrl).toContain("therapist-public-media");
    }
  });

  it("does not turn upload failures into public media", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Envie uma imagem em JPG, PNG ou WebP." },
            ok: false,
          }),
          { status: 422 },
        ),
      ),
    );

    const file = new File(["bad"], "photo.txt", { type: "text/plain" });
    const result = await uploadTherapistProfileMedia({ file, kind: "photo" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.message).toBe(
        "Envie uma imagem em JPG, PNG ou WebP.",
      );
    }
  });

  it("maps a successful private document upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              documentCenter: {
                documents: [
                  {
                    fileName: "rg.pdf",
                    id: "document-1",
                    kind: "identity_document",
                    mimeType: "application/pdf",
                    sizeBytes: 1200,
                    status: "uploaded",
                    uploadedAt: "2026-08-14T12:00:00.000Z",
                    validationState: "pending",
                  },
                ],
                verificationStatus: "submitted",
              },
            },
            ok: true,
          }),
          { status: 200 },
        ),
      ),
    );

    const file = new File(["%PDF-1.7"], "rg.pdf", { type: "application/pdf" });
    const result = await uploadTherapistPrivateDocument({
      file,
      kind: "identity_document",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.documents[0]?.kind).toBe("identity_document");
      expect(result.data.documents).toHaveLength(1);
      expect(result.data.verificationStatus).toBe("submitted");
    }
  });

  it("surfaces private document upload failures honestly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Não foi possível enviar o documento agora." },
            ok: false,
          }),
          { status: 502 },
        ),
      ),
    );

    const file = new File(["%PDF-1.7"], "rg.pdf", { type: "application/pdf" });
    const result = await uploadTherapistPrivateDocument({
      file,
      kind: "identity_document",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.message).toBe(
        "Não foi possível enviar o documento agora.",
      );
    }
  });
});
