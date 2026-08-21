import { describe, expect, it } from "vitest";

import { getTherapistAvatarUrl } from "./therapist-avatars";

describe("getTherapistAvatarUrl", () => {
  it("preserves a therapist photo uploaded to public media over a legacy local fallback", () => {
    const uploadedPhoto =
      "https://example.supabase.co/storage/v1/object/public/therapist-public-media/profile/photo.webp";

    expect(
      getTherapistAvatarUrl(uploadedPhoto, {
        name: "André Lima",
        slug: "andre-lima",
      }),
    ).toBe(uploadedPhoto);
  });

  it("uses the versioned local fallback only when no public photo exists", () => {
    expect(
      getTherapistAvatarUrl(null, { slug: "andre-lima" }),
    ).toBe("/therapists/andre-lima.png");
  });
});
