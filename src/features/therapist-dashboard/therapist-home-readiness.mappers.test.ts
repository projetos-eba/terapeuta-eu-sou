import { describe, expect, it } from "vitest";

import { TherapistPlan, TherapistStatus } from "@/domain/tes";
import type { TherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.types";
import type { TherapistProfileEditorData } from "@/features/therapist-profile-editor/therapist-profile-editor.types";

import { mapTherapistHomeReadiness } from "./therapist-home-readiness.mappers";

const profileId = "00000000-0000-4000-8000-000000000001";

describe("mapTherapistHomeReadiness", () => {
  it("keeps new therapists in the checklist until essential setup is complete", () => {
    const readiness = mapTherapistHomeReadiness({
      connect: null,
      editor: editorFixture(),
      session: {
        plan: TherapistPlan.Free,
        profileId,
        status: TherapistStatus.Draft,
      },
    });

    expect(readiness.isOperationallyReady).toBe(false);
    expect(readiness.completedRequiredCount).toBe(0);
    expect(readiness.requiredCount).toBe(3);
    expect(readiness.checklist.find((item) => item.id === "connect")).toEqual(
      expect.objectContaining({
        complete: false,
        required: false,
        state: "pending",
      }),
    );
    expect(readiness.documents).toEqual([
      expect.objectContaining({
        complete: false,
        id: "identity_document",
        state: "pending",
      }),
      expect.objectContaining({
        complete: false,
        id: "address_proof",
        state: "pending",
      }),
    ]);
    expect(readiness.profileSummary.publicName).toBe("Codex Terapeuta");
    expect(readiness.verificationStatus).toBe("draft");
  });

  it("unlocks the base dashboard when profile, services and agenda are ready", () => {
    const readiness = mapTherapistHomeReadiness({
      connect: null,
      editor: editorFixture({
        activeServiceCount: 1,
        availabilityRuleCount: 2,
        publicStatus: "published",
      }),
      session: {
        plan: TherapistPlan.Free,
        profileId,
        status: TherapistStatus.Draft,
      },
    });

    expect(readiness.isOperationallyReady).toBe(true);
    expect(readiness.completedRequiredCount).toBe(3);
    expect(readiness.requiredCount).toBe(3);
  });

  it("shows the receiving account in review as non-blocking and complete", () => {
    const readiness = mapTherapistHomeReadiness({
      connect: connectFixture({
        onboardingStatus: "onboarding_started",
        transferCapabilityStatus: "pending",
      }),
      editor: editorFixture({
        activeServiceCount: 1,
        availabilityRuleCount: 1,
        publicStatus: "published",
      }),
      session: {
        plan: TherapistPlan.PremiumPlus,
        profileId,
        status: TherapistStatus.InReview,
      },
    });

    expect(readiness.isOperationallyReady).toBe(true);
    expect(readiness.checklist.find((item) => item.id === "connect")).toEqual(
      expect.objectContaining({
        complete: true,
        required: false,
        state: "in_review",
      }),
    );
  });

  it("exposes only safe document states for the registration journey", () => {
    const readiness = mapTherapistHomeReadiness({
      connect: null,
      editor: editorFixture({
        privateDocuments: [
          documentFixture({ kind: "identity_document", status: "accepted" }),
          documentFixture({ kind: "address_proof", status: "rejected" }),
        ],
      }),
      session: {
        plan: TherapistPlan.Free,
        profileId,
        status: TherapistStatus.Draft,
      },
    });

    expect(readiness.documents).toEqual([
      {
        complete: true,
        description: "Envie um documento oficial com foto.",
        id: "identity_document",
        state: "complete",
        title: "Documento de identidade",
      },
      {
        complete: false,
        description: "Envie um comprovante emitido nos últimos 90 dias.",
        id: "address_proof",
        state: "attention",
        title: "Comprovante de endereço",
      },
    ]);
  });

  it("rejects profile data from another therapist", () => {
    expect(() =>
      mapTherapistHomeReadiness({
        connect: null,
        editor: editorFixture({
          therapistProfileId: "00000000-0000-4000-8000-000000000099",
        }),
        session: {
          plan: TherapistPlan.Free,
          profileId,
          status: TherapistStatus.Draft,
        },
      }),
    ).toThrow("therapist_home_profile_mismatch");
  });
});

function editorFixture(
  overrides: Partial<{
    activeServiceCount: number;
    availabilityRuleCount: number;
    publicStatus: TherapistProfileEditorData["derived"]["publicStatus"];
    privateDocuments: TherapistProfileEditorData["privateDocuments"];
    therapistProfileId: string;
  }> = {},
): TherapistProfileEditorData {
  return {
    capabilities: {
      canCustomizePublicSlug: false,
      canPublishAdditionalServices: true,
      canPublishProfile: true,
      canUploadVideo: true,
      canUseAdvancedSections: true,
      canUseFeaturedMedia: true,
    },
    completeness: {
      items: [],
      percent: 17,
      score: 1,
      total: 6,
    },
    derived: {
      accountStatus: "draft",
      activeServiceCount: overrides.activeServiceCount ?? 0,
      availabilityRuleCount: overrides.availabilityRuleCount ?? 0,
      averageRating: null,
      canReceiveBookings: false,
      completedSessions: 0,
      hasAvailability: (overrides.availabilityRuleCount ?? 0) > 0,
      plan: "free",
      publicStatus: overrides.publicStatus ?? "draft",
      reviewCount: 0,
      startingPriceCents: null,
      verificationStatus: "draft",
    },
    draft: null,
    privateDocuments: overrides.privateDocuments ?? [],
    propagationNotice: "",
    publicProfileHref: "/terapeutas/teste",
    publicProfileSlug: "teste",
    publicProfileTheme: "serene",
    published: {
      baseProfileVersion: null,
      contentVersionId: null,
      fields: {
        bioIllustrationId: null,
        bio: "",
        city: "",
        essenceBody: "",
        experienceYears: null,
        guideItems: [],
        headline: "",
        invitationBody: "",
        photoUrl: "",
        publicName: "Codex Terapeuta",
        publicProfileTheme: "serene",
        reflections: [],
        shortIntro: "",
        state: "",
        videoProvider: "external",
        videoThumbnailUrl: "",
        videoTitle: "",
        videoUrl: "",
      },
      publishedAt: null,
      status: "published",
      updatedAt: null,
    },
    therapistProfileId: overrides.therapistProfileId ?? profileId,
    updatedAt: "2026-08-07T10:00:00.000Z",
    verificationSummary: null,
    version: 1,
  };
}

function documentFixture(
  overrides: Partial<TherapistProfileEditorData["privateDocuments"][number]>,
): TherapistProfileEditorData["privateDocuments"][number] {
  return {
    createdAt: "2026-08-07T10:00:00.000Z",
    fileName: "documento.pdf",
    fileSizeBytes: 1024,
    id: "00000000-0000-4000-8000-000000000010",
    kind: "identity_document",
    mimeType: "application/pdf",
    reviewNote: null,
    reviewedAt: null,
    status: "uploaded",
    updatedAt: "2026-08-07T10:00:00.000Z",
    validationState: "passed",
    ...overrides,
  };
}

function connectFixture(
  overrides: Partial<
    Pick<
      TherapistConnectAccount,
      "onboardingStatus" | "transferCapabilityStatus"
    >
  > = {},
): TherapistConnectAccount {
  return {
    accountExists: true,
    chargesEnabled: false,
    contractVersion: 1,
    currentlyDue: [],
    detailsSubmitted: true,
    disabledReason: null,
    eventuallyDue: [],
    generatedAt: "2026-08-07T10:00:00.000Z",
    lastSyncedAt: "2026-08-07T10:00:00.000Z",
    maskedAccountId: "acct_1234",
    maskedBankAccountSummary: null,
    onboardingStatus: overrides.onboardingStatus ?? "ready",
    payoutsEnabled: false,
    pendingVerification: [],
    therapistProfileId: profileId,
    transferCapabilityStatus: overrides.transferCapabilityStatus ?? "active",
  };
}
