import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadTherapistProfileMedia } from "./therapist-profile-editor.commands";

describe("therapist profile media commands", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
