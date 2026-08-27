import { describe, expect, it } from "vitest";

import { resolvePatientAvatarUrl } from "./patient-overview.avatar";

describe("patient avatar source", () => {
  it.each([
    [
      "the patient profile photo",
      "https://project.supabase.co/storage/v1/object/public/patient-public-media/patient-id/avatar-new.webp",
      "https://project.supabase.co/storage/v1/object/public/profiles/legacy.webp",
      "https://project.supabase.co/storage/v1/object/public/patient-public-media/patient-id/avatar-new.webp",
    ],
    [
      "the legacy profile photo when the patient profile is empty",
      null,
      "https://project.supabase.co/storage/v1/object/public/profiles/legacy.webp",
      "https://project.supabase.co/storage/v1/object/public/profiles/legacy.webp",
    ],
  ])("uses %s", (_description, patientAvatarUrl, profileAvatarUrl, expected) => {
    expect(resolvePatientAvatarUrl(patientAvatarUrl, profileAvatarUrl)).toBe(
      expected,
    );
  });
});
