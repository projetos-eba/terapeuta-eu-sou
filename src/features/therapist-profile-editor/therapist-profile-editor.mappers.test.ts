import { describe, expect, it } from "vitest";

import {
  buildInitialEditorFields,
  mapTherapistProfileEditorContract,
  serializeEditorPayload,
} from "./therapist-profile-editor.mappers";

const contract = {
  capabilities: {
    canPublishAdditionalServices: true,
    canPublishProfile: true,
    canUploadVideo: true,
    canUseAdvancedSections: false,
    canUseFeaturedMedia: true,
  },
  completeness: {
    items: [{ complete: true, key: "photo", label: "Foto de perfil" }],
    percent: 80,
    score: 4,
    total: 5,
  },
  derived: {
    accountStatus: "approved",
    activeServiceCount: 2,
    availabilityRuleCount: 3,
    averageRating: 4.9,
    canReceiveBookings: true,
    completedSessions: 12,
    hasAvailability: true,
    plan: "premium_plus",
    publicStatus: "published",
    reviewCount: 8,
    startingPriceCents: 17000,
    verificationStatus: "approved",
  },
  draft: {
    baseProfileVersion: 4,
    contentVersionId: "draft-version",
    fields: {
      publicName: "Ana Draft",
      shortIntro: "Rascunho privado",
    },
    publishedAt: null,
    status: "draft",
    updatedAt: "2026-07-28T12:00:00.000Z",
  },
  propagationNotice: "Propaga em ate 2 a 3 horas.",
  publicProfileHref: "/terapeutas/ana-oliveira",
  published: {
    contentVersionId: "published-version",
    fields: {
      publicName: "Ana Publicada",
      shortIntro: "Publicado",
    },
    publishedAt: "2026-07-27T12:00:00.000Z",
    status: "published",
    updatedAt: "2026-07-27T12:00:00.000Z",
  },
  verificationSummary: {
    changesRequested: null,
    id: "verification-1",
    rejectionReason: null,
    reviewedAt: null,
    status: "approved",
    submittedAt: "2026-07-28T11:10:00.000Z",
  },
  therapistProfileId: "c1000000-0000-4000-8000-000000000001",
  updatedAt: "2026-07-28T12:00:00.000Z",
  version: 4,
};

describe("therapist profile editor mappers", () => {
  it("maps the private editor contract", () => {
    const editor = mapTherapistProfileEditorContract(contract);

    expect(editor.therapistProfileId).toBe(
      "c1000000-0000-4000-8000-000000000001",
    );
    expect(editor.derived.startingPriceCents).toBe(17000);
    expect(editor.completeness.percent).toBe(80);
  });

  it("maps the administrative correction reason without exposing other review data", () => {
    const editor = mapTherapistProfileEditorContract({
      ...contract,
      derived: {
        ...contract.derived,
        accountStatus: "changes_requested",
        publicStatus: "unpublished",
        verificationStatus: "changes_requested",
      },
      verificationSummary: {
        ...contract.verificationSummary,
        changesRequested: "Atualize a apresentação do seu perfil.",
        status: "changes_requested",
      },
    });

    expect(editor.verificationSummary?.changesRequested).toBe(
      "Atualize a apresentação do seu perfil.",
    );
  });

  it("keeps an approved legacy profile approved when its verification history is absent", () => {
    const editor = mapTherapistProfileEditorContract({
      ...contract,
      derived: {
        ...contract.derived,
        verificationStatus: "none",
      },
    });

    expect(editor.derived.verificationStatus).toBe("approved");
  });

  it("prefers draft fields for the editor form without replacing published data", () => {
    const editor = mapTherapistProfileEditorContract(contract);

    expect(buildInitialEditorFields(editor).publicName).toBe("Ana Draft");
    expect(editor.published.fields.publicName).toBe("Ana Publicada");
  });

  it("serializes blank strings as null for server payloads", () => {
    const editor = mapTherapistProfileEditorContract(contract);
    const payload = serializeEditorPayload({
      ...buildInitialEditorFields(editor),
      videoUrl: " ",
    });

    expect(payload.videoUrl).toBeNull();
  });

  it("removes empty guide items and reflections before sending the payload", () => {
    const editor = mapTherapistProfileEditorContract(contract);
    const payload = serializeEditorPayload({
      ...buildInitialEditorFields(editor),
      guideItems: [
        { icon: "sparkles", label: "Escuta" },
        { icon: "sparkles", label: "   " },
      ],
      reflections: [
        {
          excerpt: "",
          href: "",
          imageUrl: "",
          minutesToRead: 3,
          title: "Sobre a vida curta",
        },
        {
          excerpt: "",
          href: "",
          imageUrl: "",
          minutesToRead: 3,
          title: "   ",
        },
      ],
    });

    expect(payload.guideItems).toEqual([{ icon: "sparkles", label: "Escuta" }]);
    expect(payload.reflections).toEqual([
      {
        excerpt: null,
        href: null,
        imageUrl: null,
        minutesToRead: 3,
        title: "Sobre a vida curta",
      },
    ]);
  });
});
