import { describe, expect, it } from "vitest";

import {
  DEFAULT_THERAPIST_AVATAR_URL,
  getTherapistAvatarUrl,
} from "./therapist-avatars";

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

  it("uses the provided default avatar only when no public photo exists", () => {
    expect(
      getTherapistAvatarUrl(null, { slug: "andre-lima" }),
    ).toBe(DEFAULT_THERAPIST_AVATAR_URL);
  });
});
